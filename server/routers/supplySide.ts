import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { htsTariffRates, freightConfig, priceSnapshots } from "../../drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Default freight config values (Dan's spreadsheet) ────────────────────────
const DEFAULT_FREIGHT_CONFIG = [
  {
    key: "ocean_freight_per_cuft",
    value: "3.500000",
    label: "Ocean Freight Rate",
    unit: "$/cu ft",
    formulaNote: "Unit Cu Ft × Rate = Ocean Freight $. Unit Cu Ft = (L cm × W cm × H cm) ÷ 1,000,000 × 35.3147 ÷ Pcs per Carton.",
    sourceNote: "Dan's working rate — confirm with Chuck. Historical Lynden/ZD USA invoices suggest $3.00–$4.00/cu ft range.",
  },
  {
    key: "load_pct",
    value: "0.050000",
    label: "Origin Load %",
    unit: "% of FOB",
    formulaNote: "FOB × Load % = Load $. Covers inland trucking from factory to origin port (e.g., Nanjing → Ningbo).",
    sourceNote: "Dan's spreadsheet Assumptions tab, cell C9. Typical range 3–7%.",
  },
  {
    key: "destination_total",
    value: "1545.000000",
    label: "Destination Charges (per 40' HC container)",
    unit: "$/container",
    formulaNote: "Allocated per unit by cubic feet: Unit Cu Ft × (Destination Total ÷ Usable Cu Ft per Container). Usable = 2,400 cu ft.",
    sourceNote: "Lynden Logistics invoice #40726271. Components: Delivery/drayage $660, Chassis $360, Yard prepull & storage $400, Driver detention $125.",
  },
  {
    key: "drayage_per_container",
    value: "600.000000",
    label: "Drayage (per container)",
    unit: "$/container",
    formulaNote: "Allocated per unit by cubic feet: Unit Cu Ft × (Drayage ÷ Usable Cu Ft per Container). Usable = 2,400 cu ft.",
    sourceNote: "Chuck's confirmed rate — $600 per container ordered.",
  },
  {
    key: "entry_fees_total",
    value: "235.000000",
    label: "Entry Fees (per shipment)",
    unit: "$/shipment",
    formulaNote: "Allocated per unit by cubic feet: Unit Cu Ft × (Entry Fees ÷ Usable Cu Ft per Container). Usable = 2,400 cu ft.",
    sourceNote: "Dan's spreadsheet. Components: Customs clearance $125, ISF filing $45, Handling fees $65.",
  },
  {
    key: "container_usable_cuft",
    value: "2400.000000",
    label: "Usable Cubic Feet per 40' HC Container",
    unit: "cu ft",
    formulaNote: "Used as the denominator when allocating destination and entry fees across units. A 40' HC container has ~2,700 gross cu ft; 2,400 is the usable figure after dunnage.",
    sourceNote: "Standard industry figure for 40' high-cube container utilization.",
  },
  {
    key: "hmf_pct",
    value: "0.001250",
    label: "Harbor Maintenance Fee (HMF)",
    unit: "% of FOB",
    formulaNote: "FOB × 0.125% = HMF $. Applied to all commercial cargo entering US ports.",
    sourceNote: "US CBP regulatory rate. See 19 CFR 24.24.",
  },
  {
    key: "mpf_pct",
    value: "0.003464",
    label: "Merchandise Processing Fee (MPF)",
    unit: "% of FOB",
    formulaNote: "FOB × 0.3464% = MPF $. Applied to all formal entries. Min $32.71, max $634.62 per entry (2024 rates).",
    sourceNote: "US CBP regulatory rate. See 19 CFR 24.23.",
  },
];

// ─── Default HTS codes (from Dan's spreadsheet Assumptions tab) ───────────────
const DEFAULT_HTS_CODES = [
  {
    htsCode: "2827.20/2836.30",
    description: "Chlorinating chemicals / pool chemicals",
    baseDutyPct: "0",
    sec301Pct: "25",
    sec232Pct: "0",
    sec122Pct: "10",
    sourceUrl: "https://hts.usitc.gov/",
    notes: "Chemicals category. Sec 301 List 3.",
  },
  {
    htsCode: "3921.13.5000",
    description: "Cellular plastics — pool liners, foam products",
    baseDutyPct: "6.5",
    sec301Pct: "25",
    sec232Pct: "0",
    sec122Pct: "10",
    sourceUrl: "https://hts.usitc.gov/",
    notes: "Liner accessories, foam floats.",
  },
  {
    htsCode: "8413.70.2004",
    description: "Centrifugal pumps — pool pumps (above ground & in-ground)",
    baseDutyPct: "0",
    sec301Pct: "25",
    sec232Pct: "0",
    sec122Pct: "10",
    sourceUrl: "https://hts.usitc.gov/",
    notes: "Above-ground pumps, in-ground pumps, booster pumps, VS pumps.",
  },
  {
    htsCode: "8418.61.0100",
    description: "Heat pumps for pool heating",
    baseDutyPct: "0",
    sec301Pct: "25",
    sec232Pct: "0",
    sec122Pct: "10",
    sourceUrl: "https://hts.usitc.gov/",
    notes: "Pool heat pumps.",
  },
  {
    htsCode: "8421.21.0000",
    description: "Filtering machinery — pool filters (sand, cartridge, DE)",
    baseDutyPct: "0",
    sec301Pct: "25",
    sec232Pct: "0",
    sec122Pct: "10",
    sourceUrl: "https://hts.usitc.gov/",
    notes: "Cartridge filters, sand filters, DE filters, salt systems.",
  },
  {
    htsCode: "9506.99.5500",
    description: "Swimming pool equipment — ladders, steps, accessories",
    baseDutyPct: "5.3",
    sec301Pct: "25",
    sec232Pct: "0",
    sec122Pct: "10",
    sourceUrl: "https://hts.usitc.gov/",
    notes: "Ladders, steps, brushes, skimmers, poles, hoses, covers, floats, cleaners.",
  },
  {
    htsCode: "9603.90.8050",
    description: "Brushes and cleaning tools — pool brushes, leaf rakes",
    baseDutyPct: "2.8",
    sec301Pct: "25",
    sec232Pct: "0",
    sec122Pct: "10",
    sourceUrl: "https://hts.usitc.gov/",
    notes: "Pool brushes, leaf rakes, vacuum heads.",
  },
];

export const supplySideRouter = router({
  // ─── HTS Tariff Rates ──────────────────────────────────────────────────────
  "hts.list": publicProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const rows = await db.select().from(htsTariffRates).orderBy(asc(htsTariffRates.htsCode));
    return rows;
  }),

  "hts.upsert": publicProcedure
    .input(
      z.object({
        id: z.number().optional(),
        htsCode: z.string().min(1).max(32),
        description: z.string().max(255).optional(),
        baseDutyPct: z.string().optional(),
        sec301Pct: z.string().optional(),
        sec232Pct: z.string().optional(),
        sec122Pct: z.string().optional(),
        sourceUrl: z.string().max(512).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      if (input.id) {
        await db
          .update(htsTariffRates)
          .set({
            htsCode: input.htsCode,
            description: input.description ?? null,
            baseDutyPct: input.baseDutyPct ?? "0",
            sec301Pct: input.sec301Pct ?? "0",
            sec232Pct: input.sec232Pct ?? "0",
            sec122Pct: input.sec122Pct ?? "0",
            sourceUrl: input.sourceUrl ?? null,
            notes: input.notes ?? null,
          })
          .where(eq(htsTariffRates.id, input.id));
        return { success: true };
      } else {
        await db.insert(htsTariffRates).values({
          htsCode: input.htsCode,
          description: input.description ?? null,
          baseDutyPct: input.baseDutyPct ?? "0",
          sec301Pct: input.sec301Pct ?? "0",
          sec232Pct: input.sec232Pct ?? "0",
          sec122Pct: input.sec122Pct ?? "0",
          sourceUrl: input.sourceUrl ?? null,
          notes: input.notes ?? null,
        });
        return { success: true };
      }
    }),

  "hts.delete": publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(htsTariffRates).where(eq(htsTariffRates.id, input.id));
      return { success: true };
    }),

  "hts.seed": publicProcedure.mutation(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const existing = await db.select().from(htsTariffRates);
    if (existing.length > 0) return { seeded: false, message: "HTS codes already exist" };
    for (const row of DEFAULT_HTS_CODES) {
      await db.insert(htsTariffRates).values(row).onDuplicateKeyUpdate({ set: { description: row.description } });
    }
    return { seeded: true, count: DEFAULT_HTS_CODES.length };
  }),

  // ─── Freight Config ────────────────────────────────────────────────────────
  "freightConfig.get": publicProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const rows = await db.select().from(freightConfig).orderBy(asc(freightConfig.id));
    return rows;
  }),

  "freightConfig.update": publicProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
        sourceNote: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const existing = await db.select().from(freightConfig).where(eq(freightConfig.key, input.key));
      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `Config key '${input.key}' not found` });
      await db
        .update(freightConfig)
        .set({ value: input.value, sourceNote: input.sourceNote ?? existing[0].sourceNote })
        .where(eq(freightConfig.key, input.key));
      return { success: true };
    }),

  "freightConfig.seed": publicProcedure.mutation(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const existing = await db.select().from(freightConfig);
    if (existing.length > 0) return { seeded: false, message: "Freight config already seeded" };
    for (const row of DEFAULT_FREIGHT_CONFIG) {
      await db.insert(freightConfig).values(row).onDuplicateKeyUpdate({ set: { label: row.label } });
    }
    return { seeded: true, count: DEFAULT_FREIGHT_CONFIG.length };
  }),

  // ─── Landed Cost Computation ───────────────────────────────────────────────
  // Computes the full landed cost breakdown for a SKU given its FOB and dims
  "landedCost.compute": publicProcedure
    .input(
      z.object({
        fobCost: z.number(),           // FOB cost in dollars
        htsCode: z.string().optional(), // HTS code to look up tariff rates
        cartonL: z.number().optional(), // carton length in cm
        cartonW: z.number().optional(), // carton width in cm
        cartonH: z.number().optional(), // carton height in cm
        pcsPerCarton: z.number().optional().default(1),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Load freight config
      const configRows = await db.select().from(freightConfig);
      const cfg: Record<string, number> = {};
      for (const row of configRows) {
        cfg[row.key] = Number(row.value);
      }

      // Fall back to defaults if not seeded
      const oceanPerCuft = cfg["ocean_freight_per_cuft"] ?? 3.5;
      const loadPct = cfg["load_pct"] ?? 0.05;
      const destinationTotal = cfg["destination_total"] ?? 1545;
      const drayagePerContainer = cfg["drayage_per_container"] ?? 600;
      const entryFeesTotal = cfg["entry_fees_total"] ?? 235;
      const containerUsableCuft = cfg["container_usable_cuft"] ?? 2400;
      const hmfPct = cfg["hmf_pct"] ?? 0.00125;
      const mpfPct = cfg["mpf_pct"] ?? 0.003464;

      // Look up HTS tariff rates
      let baseDutyPct = 0, sec301Pct = 0, sec232Pct = 0, sec122Pct = 0;
      let htsRow = null;
      if (input.htsCode) {
        const htsRows = await db
          .select()
          .from(htsTariffRates)
          .where(eq(htsTariffRates.htsCode, input.htsCode));
        if (htsRows.length > 0) {
          htsRow = htsRows[0];
          baseDutyPct = Number(htsRow.baseDutyPct ?? 0) / 100;
          sec301Pct = Number(htsRow.sec301Pct ?? 0) / 100;
          sec232Pct = Number(htsRow.sec232Pct ?? 0) / 100;
          sec122Pct = Number(htsRow.sec122Pct ?? 0) / 100;
        }
      }

      const fob = input.fobCost;

      // Step 1: Load
      const loadAmt = fob * loadPct;

      // Step 2: Tariff and Duty
      const tariffPct = sec301Pct + sec232Pct + sec122Pct;
      const tariffAmt = fob * tariffPct;
      const dutyAmt = fob * baseDutyPct;

      // Step 3: Volumetric freight (requires dims)
      let unitCuFt = 0;
      let hasDims = false;
      if (input.cartonL && input.cartonW && input.cartonH && input.pcsPerCarton) {
        unitCuFt = (input.cartonL * input.cartonW * input.cartonH) / 1_000_000 * 35.3147 / input.pcsPerCarton;
        hasDims = true;
      }

      const oceanFreightAmt = hasDims ? unitCuFt * oceanPerCuft : 0;
      const destinationAmt = hasDims ? unitCuFt * (destinationTotal / containerUsableCuft) : 0;
      const drayageAmt = hasDims ? unitCuFt * (drayagePerContainer / containerUsableCuft) : 0;
      const entryFeesAmt = hasDims ? unitCuFt * (entryFeesTotal / containerUsableCuft) : 0;

      // Step 4: HMF and MPF
      const hmfAmt = fob * hmfPct;
      const mpfAmt = fob * mpfPct;

      // Total landed cost
      const landedCost = fob + loadAmt + tariffAmt + dutyAmt + oceanFreightAmt + destinationAmt + drayageAmt + entryFeesAmt + hmfAmt + mpfAmt;

      return {
        fob,
        loadPct: loadPct * 100,
        loadAmt,
        tariffPct: tariffPct * 100,
        tariffAmt,
        baseDutyPct: baseDutyPct * 100,
        dutyAmt,
        unitCuFt,
        hasDims,
        oceanFreightAmt,
        destinationAmt,
        drayageAmt,
        entryFeesAmt,
        hmfAmt,
        mpfAmt,
        landedCost,
        htsCode: input.htsCode ?? null,
        htsDescription: htsRow?.description ?? null,
        // Breakdown for display
        breakdown: [
          { label: "FOB Cost", amount: fob, formula: "Source: supplier quote", isBase: true },
          { label: "Origin Load", amount: loadAmt, formula: `FOB × ${(loadPct * 100).toFixed(1)}%`, source: "Origin handling & inland freight to port" },
          { label: "Section 301 Tariff", amount: fob * sec301Pct, formula: `FOB × ${(sec301Pct * 100).toFixed(1)}%`, source: "USTR Section 301 China tariff" },
          { label: "Section 232 Tariff", amount: fob * sec232Pct, formula: `FOB × ${(sec232Pct * 100).toFixed(1)}%`, source: "Section 232 steel/aluminum surcharge" },
          { label: "Section 122 Tariff", amount: fob * sec122Pct, formula: `FOB × ${(sec122Pct * 100).toFixed(1)}%`, source: "Section 122 additional tariff" },
          { label: "Base Duty", amount: dutyAmt, formula: `FOB × ${(baseDutyPct * 100).toFixed(2)}%`, source: `HTS ${input.htsCode ?? "—"} standard duty rate` },
          { label: "Ocean Freight", amount: oceanFreightAmt, formula: hasDims ? `${unitCuFt.toFixed(3)} cu ft × $${oceanPerCuft}/cu ft` : "No dims — enter carton dimensions", source: "Volumetric rate — confirm with Chuck" },
          { label: "Destination Charges", amount: destinationAmt, formula: hasDims ? `${unitCuFt.toFixed(3)} cu ft × ($${destinationTotal} ÷ ${containerUsableCuft} cu ft)` : "No dims", source: "Lynden invoice #40726271: chassis, yard prepull & storage, driver detention" },
          { label: "Drayage", amount: drayageAmt, formula: hasDims ? `${unitCuFt.toFixed(3)} cu ft × ($${drayagePerContainer} ÷ ${containerUsableCuft} cu ft)` : "No dims", source: "Chuck's confirmed rate — $600 per container" },
          { label: "Entry Fees", amount: entryFeesAmt, formula: hasDims ? `${unitCuFt.toFixed(3)} cu ft × ($${entryFeesTotal} ÷ ${containerUsableCuft} cu ft)` : "No dims", source: "Customs clearance $125, ISF $45, handling $65" },
          { label: "Harbor Maintenance Fee", amount: hmfAmt, formula: `FOB × ${(hmfPct * 100).toFixed(4)}%`, source: "US CBP — 19 CFR 24.24" },
          { label: "Merchandise Processing Fee", amount: mpfAmt, formula: `FOB × ${(mpfPct * 100).toFixed(4)}%`, source: "US CBP — 19 CFR 24.23 (min $32.71, max $634.62 per entry)" },
          { label: "Total Landed Cost", amount: landedCost, formula: "Sum of all above", isTotal: true },
        ],
      };
    }),

  // ─── Customer History / PNL Analysis ──────────────────────────────────────
  // Returns per-customer PNL: qty, avg price paid (2 seasons), 2027 landed,
  // import net at their tier, domestic net, % increase, PNL prior vs now
  "customerHistory.get": publicProcedure
    .input(
      z.object({
        customerId: z.number(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get customer + tier
      const { customers, tierDiscounts, dealerMarginRules, skus, skuPricing } = await import("../../drizzle/schema");
      const customerRows = await db.select().from(customers).where(eq(customers.id, input.customerId));
      if (customerRows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      const customer = customerRows[0];

      // Get tier discount for this customer
      const tierRows = await db.select().from(tierDiscounts).where(eq(tierDiscounts.tier, customer.tier));
      const tierDiscountPct = tierRows.length > 0 ? Number(tierRows[0].discountPct ?? 0) / 100 : 0;

      // Get global margins
      const marginRows = await db.select().from(dealerMarginRules);
      const globalImport = marginRows.find(r => r.scope === "global")?.importMarginPct;
      const globalDomestic = marginRows.find(r => r.scope === "global")?.domesticMarginPct;
      const importMargin = globalImport ? Number(globalImport) / 100 : 0.20;
      const domesticMargin = globalDomestic ? Number(globalDomestic) / 100 : 0.35;

      // Get all SKUs with 2025-26 sales data and 2027 FOB
      const { sql } = await import("drizzle-orm");
      const skuRows = await db
        .select({
          id: skus.id,
          sku: skus.sku,
          description: skus.description,
          salesQty: skus.salesQty2024Ytd,
          avgPrice: skus.avgPrice2024Ytd,
          salesAmt: skus.salesAmt2024Ytd,
          fob2027Price: skus.fob2027Price,
          fob2027Status: skus.fob2027Status,
          landedCost: skuPricing.landedCost,
          bdLicenseFeePct: skuPricing.bdLicenseFeePct,
        })
        .from(skus)
        .leftJoin(skuPricing, eq(skus.id, skuPricing.skuId))
        .where(sql`${skus.salesQty2024Ytd} IS NOT NULL AND ${skus.salesQty2024Ytd} > 0`)
        .orderBy(desc(skus.salesAmt2024Ytd))
        .limit(input.limit)
        .offset(input.offset);

      const results = skuRows.map(row => {
        const qty = Number(row.salesQty ?? 0);
        const avgPricePaid = Number(row.avgPrice ?? 0);
        const landed = Number(row.landedCost ?? row.fob2027Price ?? 0);
        const royalty = Number(row.bdLicenseFeePct ?? 0);

        // Import list price: landed ÷ (1 - importMargin - royalty)
        const importDenom = 1 - importMargin - royalty;
        const importList = importDenom > 0 ? landed / importDenom : 0;
        const importNet = importList * (1 - tierDiscountPct);

        // Domestic list price: landed ÷ (1 - domesticMargin - royalty)
        const domesticDenom = 1 - domesticMargin - royalty;
        const domesticList = domesticDenom > 0 ? landed / domesticDenom : 0;
        const domesticNet = domesticList * (1 - tierDiscountPct);

        // PNL calculations
        const pnlPrior = qty * (avgPricePaid - landed);   // prior contribution at new cost
        const pnlNow = qty * (importNet - landed);          // new contribution at 2027 import net
        const pctIncrease = avgPricePaid > 0 ? (importNet / avgPricePaid) - 1 : null;

        return {
          skuId: row.id,
          sku: row.sku,
          description: row.description,
          qty2025_26: qty,
          totalSales2025_26: Number(row.salesAmt ?? 0),
          avgPricePaid,
          landed2027: landed,
          fob2027Status: row.fob2027Status,
          royaltyPct: royalty * 100,
          importList,
          importNet,
          domesticList,
          domesticNet,
          pctIncrease,
          pnlPrior,
          pnlNow,
          hasCost: landed > 0,
        };
      });

      return {
        customer: { id: customer.id, name: customer.name, tier: customer.tier },
        tierDiscountPct: tierDiscountPct * 100,
        importMarginPct: importMargin * 100,
        domesticMarginPct: domesticMargin * 100,
        items: results,
        totals: {
          totalSales: results.reduce((s, r) => s + r.totalSales2025_26, 0),
          totalPnlPrior: results.reduce((s, r) => s + r.pnlPrior, 0),
          totalPnlNow: results.reduce((s, r) => s + r.pnlNow, 0),
        },
      };
    }),

  // ─── Price Snapshots ───────────────────────────────────────────────────────
  "snapshots.list": publicProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const rows = await db
      .select({
        id: priceSnapshots.id,
        label: priceSnapshots.label,
        scope: priceSnapshots.scope,
        skuCount: priceSnapshots.skuCount,
        notes: priceSnapshots.notes,
        createdAt: priceSnapshots.createdAt,
      })
      .from(priceSnapshots)
      .orderBy(desc(priceSnapshots.createdAt));
    return rows;
  }),

  "snapshots.save": publicProcedure
    .input(
      z.object({
        label: z.string().min(1).max(128),
        scope: z.enum(["supply", "buy"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { skus, skuPricing, dealerMarginRules, tierDiscounts } = await import("../../drizzle/schema");

      let snapshotData: object;
      let skuCount = 0;

      if (input.scope === "supply") {
        // Snapshot: all SKU cost/pricing data
        const rows = await db
          .select({
            id: skus.id,
            sku: skus.sku,
            fob2027Price: skus.fob2027Price,
            fob2027Status: skus.fob2027Status,
            landedCost: skuPricing.landedCost,
            factoryCost: skuPricing.factoryCost,
            fob26Costing: skuPricing.fob26Costing,
            tariffPct: skuPricing.tariffPct,
            dutyPct: skuPricing.dutyPct,
            freight: skuPricing.freight,
            bdLicenseFeePct: skuPricing.bdLicenseFeePct,
          })
          .from(skus)
          .leftJoin(skuPricing, eq(skus.id, skuPricing.skuId));
        skuCount = rows.length;
        snapshotData = { type: "supply", capturedAt: new Date().toISOString(), rows };
      } else {
        // Snapshot: all margin rules, tier discounts, and overrides
        const marginRows = await db.select().from(dealerMarginRules);
        const tierRows = await db.select().from(tierDiscounts);
        skuCount = 0;
        snapshotData = {
          type: "buy",
          capturedAt: new Date().toISOString(),
          marginRules: marginRows,
          tierDiscounts: tierRows,
        };
      }

      const result = await db.insert(priceSnapshots).values({
        label: input.label,
        scope: input.scope,
        snapshotData: JSON.stringify(snapshotData),
        skuCount,
        notes: input.notes ?? null,
      });

      return { success: true, id: Number((result as any).insertId) };
    }),

  "snapshots.get": publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await db.select().from(priceSnapshots).where(eq(priceSnapshots.id, input.id));
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });
      const snap = rows[0];
      return {
        ...snap,
        snapshotData: JSON.parse(snap.snapshotData),
      };
    }),

  "snapshots.delete": publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.delete(priceSnapshots).where(eq(priceSnapshots.id, input.id));
      return { success: true };
    }),
});
