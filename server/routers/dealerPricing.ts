/**
 * Dealer Pricing Router — 2027 Model
 *
 * Pricing formula (Dan's Excel, Mode 1 — Discount off list):
 *   list_price = landed_cost ÷ (1 − margin% − royalty%)
 *   net_price  = list_price × (1 − discount%)
 *
 * Margin resolution (most specific wins):
 *   global → category → vendor → sku
 *
 * Discount resolution (most specific wins):
 *   tier → customer → sku×customer
 *
 * BD Royalty categories (% of list price):
 *   Cat 1 = 3.5%  (Above Ground Pumps, Booster Pumps, In-Ground Pumps, Pool Cleaners, Pumps-Other, Pumps-VS)
 *   Cat 2 = 5.5%  (Automation, Cartridge Filters, Filter Systems, Pool Alarms, Salt Systems, Sand Filters)
 *   Cat 3 = 7.0%  (Brushes, Cover Pumps, Skimmers & Rakes)
 *   Cat 4 = 4.0%  (Chemicals, Heat Pumps, Ladders, Ladders & Steps)
 *   null  = 0%    (non-BD categories)
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  customers,
  dealerMarginRules,
  tierDiscounts,
  customerDiscountOverrides,
  skuDiscountOverrides,
  dealerPriceOverrides,
  pricingLocks,
  pricingConfig,
  skus,
  skuPricing,
} from "../../drizzle/schema";
import { eq, and, inArray, desc, asc, like, or, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ─── BD Royalty category map ──────────────────────────────────────────────────
// Note: B&D SKUs in unmapped categories (Parts & Replacement, Uncategorized) are
// confirmed 0% royalty by Dan Schonfeld (July 20, 2026). The ?? 0 fallback below
// is intentional and correct — do not add a catch-all rate.

const BD_ROYALTY_BY_CATEGORY: Record<string, number> = {
  "Above Ground Pumps": 0.035,
  "Booster Pumps": 0.035,
  "In-Ground Pumps": 0.035,
  "Pool Cleaners": 0.035,
  "Pumps - Other": 0.035,
  "Pumps - Variable Speed": 0.035,
  "Automation": 0.055,
  "Cartridge Filters": 0.055,
  "Filter Systems": 0.055,
  "Pool Alarms": 0.055,
  "Salt Systems": 0.055,
  "Sand Filters": 0.055,
  "Brushes": 0.07,
  "Cover Pumps": 0.07,
  "Skimmers & Rakes": 0.07,
  "Chemicals & Water Treatment": 0.04,
  "Heat Pumps": 0.04,
  "Ladders": 0.04,
  "Ladders & Steps": 0.04,
};

// BD_EXEMPT_CATEGORIES: categories where B&D SKUs are confirmed 0% royalty by Dan.
// These resolve to 0 via the ?? 0 fallback — listed here for documentation only.
const BD_EXEMPT_CATEGORIES = new Set([
  "Parts & Replacement",
  "Uncategorized",
]);

function getRoyaltyPct(category: string | null | undefined, isBd: string | null | undefined): number {
  if (!isBd || isBd.toLowerCase() !== "yes") return 0;
  if (!category) return 0;
  // Explicitly confirmed 0% by Dan for these categories
  if (BD_EXEMPT_CATEGORIES.has(category)) return 0;
  return BD_ROYALTY_BY_CATEGORY[category] ?? 0;
}

// ─── Pricing helpers ──────────────────────────────────────────────────────────

function computeListPrice(
  costBasis: number,
  marginPct: number,
  royaltyPct: number
): number {
  const denominator = 1 - marginPct - royaltyPct;
  if (denominator <= 0) return 0;
  return Math.round((costBasis / denominator) * 100) / 100;
}

function computeNetPrice(listPrice: number, discountPct: number): number {
  return Math.round(listPrice * (1 - discountPct) * 100) / 100;
}

function computeKeptMargin(netPrice: number, costBasis: number): number {
  if (netPrice <= 0) return 0;
  return Math.round(((netPrice - costBasis) / netPrice) * 10000) / 10000;
}

// ─── Margin resolution ────────────────────────────────────────────────────────

type MarginRuleRow = {
  scope: "global" | "category" | "vendor" | "sku";
  scopeValue: string | null;
  importMarginPct: string | null;
  domesticMarginPct: string | null;
};

function resolveMargins(
  rules: MarginRuleRow[],
  category: string | null,
  vendor: string | null,
  skuCode: string | null
): { importMargin: number; domesticMargin: number } {
  // Priority: sku > vendor > category > global
  const scopePriority = { global: 0, category: 1, vendor: 2, sku: 3 };

  let bestImport: { pct: number; priority: number } | null = null;
  let bestDomestic: { pct: number; priority: number } | null = null;

  for (const rule of rules) {
    const priority = scopePriority[rule.scope];

    // Check if this rule applies
    let applies = false;
    if (rule.scope === "global") {
      applies = true;
    } else if (rule.scope === "category" && category && rule.scopeValue === category) {
      applies = true;
    } else if (rule.scope === "vendor" && vendor && rule.scopeValue === vendor) {
      applies = true;
    } else if (rule.scope === "sku" && skuCode && rule.scopeValue === skuCode) {
      applies = true;
    }

    if (!applies) continue;

    if (rule.importMarginPct !== null) {
      const pct = parseFloat(rule.importMarginPct);
      if (!bestImport || priority > bestImport.priority) {
        bestImport = { pct, priority };
      }
    }
    if (rule.domesticMarginPct !== null) {
      const pct = parseFloat(rule.domesticMarginPct);
      if (!bestDomestic || priority > bestDomestic.priority) {
        bestDomestic = { pct, priority };
      }
    }
  }

  return {
    importMargin: bestImport?.pct ?? 0.2,
    domesticMargin: bestDomestic?.pct ?? 0.35,
  };
}

// ─── Discount resolution ──────────────────────────────────────────────────────

function resolveDiscount(
  tierDiscountMap: Record<number, number>,
  customerOverrideMap: Record<number, number>,
  skuCustomerOverrideMap: Record<string, number>,
  customerId: number,
  tier: number,
  skuId: number
): number {
  const key = `${skuId}:${customerId}`;
  if (skuCustomerOverrideMap[key] !== undefined) return skuCustomerOverrideMap[key];
  if (customerOverrideMap[customerId] !== undefined) return customerOverrideMap[customerId];
  return tierDiscountMap[tier] ?? 0;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const dealerPricingRouter = router({
  // ── Assumptions ────────────────────────────────────────────────────────────

  getAssumptions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('DB unavailable');
    const [marginRules, tiers, config, locks] = await Promise.all([
      db.select().from(dealerMarginRules).orderBy(asc(dealerMarginRules.scope), asc(dealerMarginRules.scopeValue)),
      db.select().from(tierDiscounts).orderBy(asc(tierDiscounts.tier)),
      db.select().from(pricingConfig),
      db.select().from(pricingLocks),
    ]);
    return { marginRules, tiers, config, locks };
  }),

  updateMarginRule: publicProcedure
    .input(
      z.object({
        id: z.number().optional(),
        scope: z.enum(["global", "category", "vendor", "sku"]),
        scopeValue: z.string().nullable().optional(),
        importMarginPct: z.number().min(0).max(1).nullable().optional(),
        domesticMarginPct: z.number().min(0).max(1).nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      if (input.id) {
        await db
          .update(dealerMarginRules)
          .set({
            importMarginPct: input.importMarginPct?.toString() ?? null,
            domesticMarginPct: input.domesticMarginPct?.toString() ?? null,
            notes: input.notes ?? null,
          })
          .where(eq(dealerMarginRules.id, input.id));
        return { success: true };
      }
      // Insert new rule
      await db.insert(dealerMarginRules).values({
        scope: input.scope,
        scopeValue: input.scopeValue ?? null,
        importMarginPct: input.importMarginPct?.toString() ?? null,
        domesticMarginPct: input.domesticMarginPct?.toString() ?? null,
        notes: input.notes ?? null,
      });
      return { success: true };
    }),

  deleteMarginRule: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.delete(dealerMarginRules).where(eq(dealerMarginRules.id, input.id));
      return { success: true };
    }),

  updateTierDiscount: publicProcedure
    .input(
      z.object({
        tier: z.number().int().min(1).max(3),
        discountPct: z.number().min(0).max(1),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db
        .update(tierDiscounts)
        .set({
          discountPct: input.discountPct.toString(),
          notes: input.notes ?? null,
        })
        .where(eq(tierDiscounts.tier, input.tier));
      return { success: true };
    }),

  updateConfig: publicProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db
        .update(pricingConfig)
        .set({ value: input.value })
        .where(eq(pricingConfig.key, input.key));
      return { success: true };
    }),

  // ── Customers ──────────────────────────────────────────────────────────────

  getCustomers: publicProcedure
    .input(z.object({ activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const rows = await db
        .select()
        .from(customers)
        .orderBy(asc(customers.tier), desc(customers.sales2025_26));
      return input?.activeOnly ? rows.filter((r) => r.active === 1) : rows;
    }),

  upsertCustomer: publicProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        tier: z.number().int().min(1).max(3),
        sales2025_26: z.number().nullable().optional(),
        importDepositException: z.boolean().optional(),
        notes: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      if (input.id) {
        await db
          .update(customers)
          .set({
            name: input.name,
            tier: input.tier,
            sales2025_26: input.sales2025_26?.toString() ?? null,
            importDepositException: input.importDepositException ? 1 : 0,
            notes: input.notes ?? null,
            active: input.active === false ? 0 : 1,
          })
          .where(eq(customers.id, input.id));
        return { success: true };
      }
      await db.insert(customers).values({
        name: input.name,
        tier: input.tier,
        sales2025_26: input.sales2025_26?.toString() ?? null,
        importDepositException: input.importDepositException ? 1 : 0,
        notes: input.notes ?? null,
        active: 1,
      });
      return { success: true };
    }),

  setCustomerDiscountOverride: publicProcedure
    .input(
      z.object({
        customerId: z.number(),
        discountPct: z.number().min(0).max(1).nullable(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      if (input.discountPct === null) {
        // Remove override
        await db
          .delete(customerDiscountOverrides)
          .where(eq(customerDiscountOverrides.customerId, input.customerId));
      } else {
        const existing = await db
          .select()
          .from(customerDiscountOverrides)
          .where(eq(customerDiscountOverrides.customerId, input.customerId))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(customerDiscountOverrides)
            .set({ discountPct: input.discountPct.toString(), notes: input.notes ?? null })
            .where(eq(customerDiscountOverrides.customerId, input.customerId));
        } else {
          await db.insert(customerDiscountOverrides).values({
            customerId: input.customerId,
            discountPct: input.discountPct.toString(),
            notes: input.notes ?? null,
          });
        }
      }
      return { success: true };
    }),

  // ── Buy Side Matrix ────────────────────────────────────────────────────────

  getBuySideMatrix: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
        search: z.string().optional(),
        brand: z.string().optional(),
        category: z.string().optional(),
        fob2027StatusFilter: z.string().optional(),
        customerId: z.number().optional(), // if set, return prices for this customer only
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const offset = (input.page - 1) * input.pageSize;

      // Load all margin rules and tier discounts (small tables, load once)
      const [allMarginRules, allTierDiscounts, allCustomers, allConfig] = await Promise.all([
        db.select().from(dealerMarginRules),
        db.select().from(tierDiscounts),
        db.select().from(customers).where(eq(customers.active, 1)).orderBy(asc(customers.tier), desc(customers.sales2025_26)),
        db.select().from(pricingConfig),
      ]);

      const configMap: Record<string, string> = {};
      for (const c of allConfig) {
        if (c.key && c.value) configMap[c.key] = c.value;
      }
      const pricingBasis = configMap["pricing_basis"] ?? "landed_cost";

      // Build discount lookup maps
      const tierDiscountMap: Record<number, number> = {};
      for (const td of allTierDiscounts) {
        tierDiscountMap[td.tier] = parseFloat(td.discountPct);
      }

      // Load customer overrides
      const custOverrides = await db.select().from(customerDiscountOverrides);
      const customerOverrideMap: Record<number, number> = {};
      for (const co of custOverrides) {
        customerOverrideMap[co.customerId] = parseFloat(co.discountPct);
      }

      // Build SKU query
      const skuQuery = db
        .select({
          id: skus.id,
          sku: skus.sku,
          description: skus.description,
          productGroup: skus.productGroup,
          supplier: skus.supplier,
          isBd: skus.isBd,
          fob2027Status: skus.fob2027Status,
          fob2027Price: skus.fob2027Price,
          landedCost: skuPricing.landedCost,
          landedPlusBdFees: skuPricing.landedPlusBdFees,
          fob26Costing: skuPricing.fob26Costing,
        })
        .from(skus)
        .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id));

      const conditions: ReturnType<typeof eq>[] = [];
      if (input.search) {
        conditions.push(
          or(
            like(skus.sku, `%${input.search}%`),
            like(skus.description, `%${input.search}%`)
          ) as ReturnType<typeof eq>
        );
      }
      if (input.brand) {
        if (input.brand === "BD") conditions.push(eq(skus.isBd, "Yes") as ReturnType<typeof eq>);
        else if (input.brand === "Sunnora") conditions.push(like(skus.sku, "AC%") as ReturnType<typeof eq>);
        else if (input.brand === "Blue Torrent") conditions.push(like(skus.sku, "BT%") as ReturnType<typeof eq>);
      }
      if (input.category) {
        conditions.push(eq(skus.productGroup, input.category) as ReturnType<typeof eq>);
      }
      if (input.fob2027StatusFilter) {
        conditions.push(eq(skus.fob2027Status, input.fob2027StatusFilter as "confirmed" | "placeholder" | "missing") as ReturnType<typeof eq>);
      }

      // Count total
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(skus)
        .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id));

      let skuRows: typeof skuQuery extends Promise<infer T> ? T : never;
      let totalCount: number;

      if (conditions.length > 0) {
        const [countResult] = await countQuery.where(and(...conditions));
        totalCount = Number(countResult.count);
        skuRows = await skuQuery
          .where(and(...conditions))
          .limit(input.pageSize)
          .offset(offset) as any;
      } else {
        const [countResult] = await countQuery;
        totalCount = Number(countResult.count);
        skuRows = await skuQuery.limit(input.pageSize).offset(offset) as any;
      }

      // Load SKU-level discount overrides for the current page
      type SkuRow = { id: number; sku: string; description: string | null; productGroup: string | null; supplier: string | null; isBd: string | null; fob2027Status: 'confirmed' | 'placeholder' | 'missing' | null; fob2027Price: string | null; landedCost: string | null; landedPlusBdFees: string | null; fob26Costing: string | null };
      const typedSkuRows = skuRows as SkuRow[];
      const skuIds = typedSkuRows.map((r) => r.id);
      let skuCustomerOverrideMap: Record<string, number> = {};
      let priceOverrideMap: Record<string, any> = {};

      if (skuIds.length > 0) {
        const skuDiscOverrides = await db
          .select()
          .from(skuDiscountOverrides)
          .where(inArray(skuDiscountOverrides.skuId, skuIds));
        for (const o of skuDiscOverrides) {
          skuCustomerOverrideMap[`${o.skuId}:${o.customerId}`] = parseFloat(o.discountPct);
        }

        const priceOverrides = await db
          .select()
          .from(dealerPriceOverrides)
          .where(inArray(dealerPriceOverrides.skuId, skuIds));
        for (const o of priceOverrides) {
          priceOverrideMap[`${o.skuId}:${o.customerId}`] = o;
        }
      }

      // Determine which customers to compute prices for
      const targetCustomers = input.customerId
        ? allCustomers.filter((c) => c.id === input.customerId)
        : allCustomers;

      // Compute prices for each SKU
      const result = typedSkuRows.map((skuRow) => {
        const category = skuRow.productGroup;
        const vendor = skuRow.supplier;
        const royaltyPct = getRoyaltyPct(category, skuRow.isBd);

        // Resolve margins for this SKU
        const { importMargin, domesticMargin } = resolveMargins(
          allMarginRules as MarginRuleRow[],
          category,
          vendor,
          skuRow.sku
        );

        // Determine cost basis
        const landedCost = skuRow.landedCost ? parseFloat(skuRow.landedCost) : null;
        const factoryCost = skuRow.landedPlusBdFees ? parseFloat(skuRow.landedPlusBdFees) : null;
        const costBasis =
          pricingBasis === "factory_cost" ? (factoryCost ?? landedCost) : landedCost;

        // BLOCKED: SKUs with no cost basis cannot be priced — return blocked flag instead of zero
        const isBlocked = costBasis === null || costBasis <= 0;

        // Cost delta (cost-vs-cost): 2027 landed cost vs historical avg FOB cost
        // Per Dan (July 20, 2026): tariff is a separate line item, so compare cost to cost, not price to price
        const histAvgCost = skuRow.fob26Costing ? parseFloat(skuRow.fob26Costing) : null;
        const costDelta = landedCost !== null && histAvgCost !== null && histAvgCost > 0
          ? Math.round(((landedCost - histAvgCost) / histAvgCost) * 10000) / 10000
          : null;

        let importList: number | null = null;
        let domesticList: number | null = null;

        if (!isBlocked) {
          importList = computeListPrice(costBasis!, importMargin, royaltyPct);
          domesticList = computeListPrice(costBasis!, domesticMargin, royaltyPct);
        }

        // Compute per-customer net prices
        type CustomerRow = { id: number; name: string; tier: number; sales2025_26: string | null; importDepositException: number | null; notes: string | null; active: number; createdAt: Date; updatedAt: Date };
        const customerPrices = (targetCustomers as CustomerRow[]).map((customer) => {
          const discount = resolveDiscount(
            tierDiscountMap,
            customerOverrideMap,
            skuCustomerOverrideMap,
            customer.id,
            customer.tier,
            skuRow.id
          );

          const overrideKey = `${skuRow.id}:${customer.id}`;
          const override = priceOverrideMap[overrideKey];

          const importNet = override?.importNetOverride
            ? parseFloat(override.importNetOverride)
            : importList !== null
            ? computeNetPrice(importList, discount)
            : null;

          const domesticNet = override?.domesticNetOverride
            ? parseFloat(override.domesticNetOverride)
            : domesticList !== null
            ? computeNetPrice(domesticList, discount)
            : null;

          const importListFinal = override?.importListOverride
            ? parseFloat(override.importListOverride)
            : importList;

          const domesticListFinal = override?.domesticListOverride
            ? parseFloat(override.domesticListOverride)
            : domesticList;

          const keptMarginImport =
            importNet !== null && costBasis !== null
              ? computeKeptMargin(importNet, costBasis)
              : null;
          const keptMarginDomestic =
            domesticNet !== null && costBasis !== null
              ? computeKeptMargin(domesticNet, costBasis)
              : null;

          return {
            customerId: customer.id,
            customerName: customer.name,
            tier: customer.tier,
            discount,
            hasOverride: !!override,
            importList: importListFinal,
            domesticList: domesticListFinal,
            importNet,
            domesticNet,
            keptMarginImport,
            keptMarginDomestic,
          };
        });

        return {
          skuId: skuRow.id,
          sku: skuRow.sku,
          description: skuRow.description,
          productGroup: category,
          supplier: vendor,
          isBd: skuRow.isBd,
          fob2027Status: skuRow.fob2027Status,
          fob2027Price: skuRow.fob2027Price ? parseFloat(skuRow.fob2027Price) : null,
          landedCost,
          factoryCost,
          costBasis,
          isBlocked,
          histAvgCost,
          costDelta,
          importMargin,
          domesticMargin,
          royaltyPct,
          importList,
          domesticList,
          customerPrices,
        };
      });

      return {
        rows: result,
        total: totalCount,
        page: input.page,
        pageSize: input.pageSize,
        customers: targetCustomers,
      };
    }),

  // ── Price Overrides ────────────────────────────────────────────────────────

  setOverride: publicProcedure
    .input(
      z.object({
        skuId: z.number(),
        customerId: z.number(),
        importListOverride: z.number().nullable().optional(),
        domesticListOverride: z.number().nullable().optional(),
        importNetOverride: z.number().nullable().optional(),
        domesticNetOverride: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        clear: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      if (input.clear) {
        await db
          .delete(dealerPriceOverrides)
          .where(
            and(
              eq(dealerPriceOverrides.skuId, input.skuId),
              eq(dealerPriceOverrides.customerId, input.customerId)
            )
          );
        return { success: true };
      }

      const existing = await db
        .select()
        .from(dealerPriceOverrides)
        .where(
          and(
            eq(dealerPriceOverrides.skuId, input.skuId),
            eq(dealerPriceOverrides.customerId, input.customerId)
          )
        )
        .limit(1);

      const values = {
        importListOverride: input.importListOverride?.toString() ?? null,
        domesticListOverride: input.domesticListOverride?.toString() ?? null,
        importNetOverride: input.importNetOverride?.toString() ?? null,
        domesticNetOverride: input.domesticNetOverride?.toString() ?? null,
        notes: input.notes ?? null,
      };

      if (existing.length > 0) {
        await db
          .update(dealerPriceOverrides)
          .set(values)
          .where(
            and(
              eq(dealerPriceOverrides.skuId, input.skuId),
              eq(dealerPriceOverrides.customerId, input.customerId)
            )
          );
      } else {
        await db.insert(dealerPriceOverrides).values({
          skuId: input.skuId,
          customerId: input.customerId,
          ...values,
        });
      }
      return { success: true };
    }),

  setSkuDiscountOverride: publicProcedure
    .input(
      z.object({
        skuId: z.number(),
        customerId: z.number(),
        discountPct: z.number().min(0).max(1).nullable(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      if (input.discountPct === null) {
        await db
          .delete(skuDiscountOverrides)
          .where(
            and(
              eq(skuDiscountOverrides.skuId, input.skuId),
              eq(skuDiscountOverrides.customerId, input.customerId)
            )
          );
      } else {
        const existing = await db
          .select()
          .from(skuDiscountOverrides)
          .where(
            and(
              eq(skuDiscountOverrides.skuId, input.skuId),
              eq(skuDiscountOverrides.customerId, input.customerId)
            )
          )
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(skuDiscountOverrides)
            .set({ discountPct: input.discountPct.toString(), notes: input.notes ?? null })
            .where(
              and(
                eq(skuDiscountOverrides.skuId, input.skuId),
                eq(skuDiscountOverrides.customerId, input.customerId)
              )
            );
        } else {
          await db.insert(skuDiscountOverrides).values({
            skuId: input.skuId,
            customerId: input.customerId,
            discountPct: input.discountPct.toString(),
            notes: input.notes ?? null,
          });
        }
      }
      return { success: true };
    }),

  // ── Locks ──────────────────────────────────────────────────────────────────

  getLocks: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('DB unavailable');
    const locks = await db.select().from(pricingLocks);
    // Return without password hash
    return locks.map(({ passwordHash: _ph, ...rest }: { passwordHash: string | null; id: number; scope: 'supply' | 'buy'; locked: number; lockedAt: Date | null; updatedAt: Date }) => rest);
  }),

  lock: publicProcedure
    .input(
      z.object({
        scope: z.enum(["supply", "buy"]),
        password: z.string().min(4),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const hash = await bcrypt.hash(input.password, 10);
      await db
        .update(pricingLocks)
        .set({ locked: 1, passwordHash: hash, lockedAt: new Date() })
        .where(eq(pricingLocks.scope, input.scope));
      return { success: true };
    }),

  unlock: publicProcedure
    .input(
      z.object({
        scope: z.enum(["supply", "buy"]),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [lockRow] = await db
        .select()
        .from(pricingLocks)
        .where(eq(pricingLocks.scope, input.scope))
        .limit(1);

      if (!lockRow || !lockRow.locked) {
        return { success: true, message: "Already unlocked" };
      }
      if (!lockRow.passwordHash) {
        return { success: false, message: "No password set" };
      }

      const match = await bcrypt.compare(input.password, lockRow.passwordHash);
      if (!match) {
        return { success: false, message: "Incorrect password" };
      }

      await db
        .update(pricingLocks)
        .set({ locked: 0, passwordHash: null, lockedAt: null })
        .where(eq(pricingLocks.scope, input.scope));

      return { success: true };
    }),

  // ── Export ─────────────────────────────────────────────────────────────────

  exportPriceSheet: publicProcedure
    .input(
      z.object({
        customerId: z.number(),
        format: z.enum(["import", "domestic", "both"]).default("both"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      // Get customer
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1);
      if (!customer) throw new Error("Customer not found");

      // Reuse getBuySideMatrix logic with full dataset
      const [allMarginRules, allTierDiscounts, allConfig] = await Promise.all([
        db.select().from(dealerMarginRules),
        db.select().from(tierDiscounts),
        db.select().from(pricingConfig),
      ]);

      const configMap: Record<string, string> = {};
      for (const c of allConfig) {
        if (c.key && c.value) configMap[c.key] = c.value;
      }
      const pricingBasis = configMap["pricing_basis"] ?? "landed_cost";

      const tierDiscountMap: Record<number, number> = {};
      for (const td of allTierDiscounts) {
        tierDiscountMap[td.tier] = parseFloat(td.discountPct);
      }

      const custOverrides = await db
        .select()
        .from(customerDiscountOverrides)
        .where(eq(customerDiscountOverrides.customerId, input.customerId));
      const customerOverrideMap: Record<number, number> = {};
      for (const co of custOverrides) {
        customerOverrideMap[co.customerId] = parseFloat(co.discountPct);
      }

      const allSkuRows = await db
        .select({
          id: skus.id,
          sku: skus.sku,
          description: skus.description,
          productGroup: skus.productGroup,
          supplier: skus.supplier,
          isBd: skus.isBd,
          fob2027Status: skus.fob2027Status,
          landedCost: skuPricing.landedCost,
          landedPlusBdFees: skuPricing.landedPlusBdFees,
        })
        .from(skus)
        .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id));

      const skuIds = allSkuRows.map((r) => r.id);
      const skuDiscOverrides = skuIds.length > 0
        ? await db.select().from(skuDiscountOverrides).where(
            and(
              inArray(skuDiscountOverrides.skuId, skuIds),
              eq(skuDiscountOverrides.customerId, input.customerId)
            )
          )
        : [];
      const skuCustomerOverrideMap: Record<string, number> = {};
      for (const o of skuDiscOverrides) {
        skuCustomerOverrideMap[`${o.skuId}:${o.customerId}`] = parseFloat(o.discountPct);
      }

      const priceOverrides = skuIds.length > 0
        ? await db.select().from(dealerPriceOverrides).where(
            and(
              inArray(dealerPriceOverrides.skuId, skuIds),
              eq(dealerPriceOverrides.customerId, input.customerId)
            )
          )
        : [];
      const priceOverrideMap: Record<string, any> = {};
      for (const o of priceOverrides) {
        priceOverrideMap[`${o.skuId}:${o.customerId}`] = o;
      }

      type ExportSkuRow = { id: number; sku: string; description: string | null; productGroup: string | null; supplier: string | null; isBd: string | null; fob2027Status: 'confirmed' | 'placeholder' | 'missing' | null; landedCost: string | null; landedPlusBdFees: string | null };
      const rows = (allSkuRows as ExportSkuRow[])
        .filter((r) => {
          const lc = r.landedCost ? parseFloat(r.landedCost) : null;
          const fc = r.landedPlusBdFees ? parseFloat(r.landedPlusBdFees) : null;
          const cb = pricingBasis === "factory_cost" ? (fc ?? lc) : lc;
          return cb !== null && cb > 0;
        })
        .map((skuRow) => {
          const category = skuRow.productGroup;
          const vendor = skuRow.supplier;
          const royaltyPct = getRoyaltyPct(category, skuRow.isBd);
          const { importMargin, domesticMargin } = resolveMargins(
            allMarginRules as MarginRuleRow[],
            category,
            vendor,
            skuRow.sku
          );
          const landedCost = skuRow.landedCost ? parseFloat(skuRow.landedCost) : null;
          const factoryCost = skuRow.landedPlusBdFees ? parseFloat(skuRow.landedPlusBdFees) : null;
          const costBasis = pricingBasis === "factory_cost" ? (factoryCost ?? landedCost) : landedCost;

          const importList = costBasis ? computeListPrice(costBasis, importMargin, royaltyPct) : null;
          const domesticList = costBasis ? computeListPrice(costBasis, domesticMargin, royaltyPct) : null;

          const discount = resolveDiscount(
            tierDiscountMap,
            customerOverrideMap,
            skuCustomerOverrideMap,
            input.customerId,
            customer.tier,
            skuRow.id
          );

          const overrideKey = `${skuRow.id}:${input.customerId}`;
          const override = priceOverrideMap[overrideKey];

          const importNet = override?.importNetOverride
            ? parseFloat(override.importNetOverride)
            : importList !== null ? computeNetPrice(importList, discount) : null;
          const domesticNet = override?.domesticNetOverride
            ? parseFloat(override.domesticNetOverride)
            : domesticList !== null ? computeNetPrice(domesticList, discount) : null;

          return {
            sku: skuRow.sku,
            description: skuRow.description,
            productGroup: category,
            costSource: skuRow.fob2027Status,
            costBasis,
            importMargin,
            domesticMargin,
            royaltyPct,
            discount,
            importList: override?.importListOverride ? parseFloat(override.importListOverride) : importList,
            domesticList: override?.domesticListOverride ? parseFloat(override.domesticListOverride) : domesticList,
            importNet,
            domesticNet,
            hasOverride: !!override,
          };
        });

      return {
        customer: { id: customer.id, name: customer.name, tier: customer.tier },
        rows,
      };
    }),

  importCustomers: publicProcedure
    .input(
      z.object({
        rows: z.array(
          z.object({
            name: z.string().min(1),
            tier: z.number().int().min(1).max(3),
            sales2025_26: z.number().nullable().optional(),
            notes: z.string().nullable().optional(),
          })
        ),
        mode: z.enum(["append", "replace"]).default("append"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      if (input.mode === "replace") {
        await db.delete(customers);
      }
      let inserted = 0;
      let skipped = 0;
      for (const row of input.rows) {
        // Skip if name already exists (case-insensitive) in append mode
        if (input.mode === "append") {
          const existing = await db
            .select({ id: customers.id })
            .from(customers)
            .where(sql`LOWER(${customers.name}) = LOWER(${row.name})`)
            .limit(1);
          if (existing.length > 0) { skipped++; continue; }
        }
        await db.insert(customers).values({
          name: row.name,
          tier: row.tier,
          sales2025_26: row.sales2025_26?.toString() ?? null,
          notes: row.notes ?? null,
          importDepositException: 0,
          active: 1,
        });
        inserted++;
      }
      return { success: true, inserted, skipped };
    }),

  // ── Customer SKU Sales History (from Chuck SQLite) ─────────────────────────

  getCustomerSkuSales: publicProcedure
    .input(
      z.object({
        customerId: z.number(),
        search: z.string().optional(),
        brand: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(200),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { customerSkuSales, skus } = await import('../../drizzle/schema').then(m => m);
      const conditions = [eq(customerSkuSales.customerId, input.customerId)];
      if (input.search) {
        conditions.push(
          or(
            like(customerSkuSales.skuCode, `%${input.search}%`),
            like(skus.description, `%${input.search}%`)
          )!
        );
      }
      if (input.brand) {
        conditions.push(like(skus.supplier, `%${input.brand}%`));
      }
      const rows = await db
        .select({
          id: customerSkuSales.id,
          skuCode: customerSkuSales.skuCode,
          description: skus.description,
          productGroup: skus.productGroup,
          supplier: skus.supplier,
          totalQty: customerSkuSales.totalQty,
          totalSalesAmt: customerSkuSales.totalSalesAmt,
          avgRealizedPrice: customerSkuSales.avgRealizedPrice,
          periodLabel: customerSkuSales.periodLabel,
        })
        .from(customerSkuSales)
        .leftJoin(skus, eq(customerSkuSales.skuId, skus.id))
        .where(and(...conditions))
        .orderBy(desc(customerSkuSales.totalSalesAmt))
        .limit(input.limit)
        .offset(input.offset);
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(customerSkuSales)
        .leftJoin(skus, eq(customerSkuSales.skuId, skus.id))
        .where(and(...conditions));
      return { rows, total: Number(count) };
    }),

  getCustomerSalesSummary: publicProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { customerSkuSales } = await import('../../drizzle/schema').then(m => m);
      const [summary] = await db
        .select({
          totalSkus: sql<number>`COUNT(DISTINCT ${customerSkuSales.skuCode})`,
          totalQty: sql<number>`SUM(${customerSkuSales.totalQty})`,
          totalSales: sql<number>`SUM(${customerSkuSales.totalSalesAmt})`,
          avgRealizedPrice: sql<number>`AVG(${customerSkuSales.avgRealizedPrice})`,
        })
        .from(customerSkuSales)
        .where(eq(customerSkuSales.customerId, input.customerId));
      return summary;
    }),

});
