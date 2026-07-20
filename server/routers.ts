import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  bulkImportSkus,
  bulkUpdatePricing,
  createSku,
  deleteSku,
  getProductGroups,
  getSkuById,
  getSkuList,
  getVersionHistory,
  recordVersion,
  updateSku,
  getChannels,
  getChannelPricingMatrix,
  getChannelPricesBySku,
  upsertChannelPrice,
  applyChannelPricingRule,
  exportChannelPriceSheet,
  getCartonDetailsBySkuId,
  getSourceStatuses,
  getSuppliers,
  bulkImportChannelPrices,
  getMarginAlerts,
  getChannelPriceHistory,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { dealerPricingRouter } from "./routers/dealerPricing";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminOnly(role: string | undefined) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// Compute margin fields from pricing data
function computeMargins(pricing: Record<string, any>) {
  const landed = Number(pricing.landedCost ?? 0);
  const retail25 = Number(pricing.bdWholesaleRetail25 ?? 0);
  const retail24 = Number(pricing.bdWholesaleRetail24 ?? 0);

  const bdMargin = retail25 > 0 ? retail25 - landed : null;
  const bdMarginPct = retail25 > 0 && landed > 0 ? (retail25 - landed) / retail25 : null;
  const inc2425Pct =
    retail24 > 0 && retail25 > 0 ? (retail25 - retail24) / retail24 : null;

  return { bdMargin, bdMarginPct, inc2425Pct };
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const pricingSchema = z.object({
  srp2023: z.string().nullable().optional(),
  srp2024: z.string().nullable().optional(),
  map: z.string().nullable().optional(),
  comps2024: z.string().nullable().optional(),
  srp2024Amzn: z.string().nullable().optional(),
  wholesalePoolCity: z.string().nullable().optional(),
  bdWholesaleMarginPct: z.string().nullable().optional(),
  fob26Costing: z.string().nullable().optional(),
  factoryCost: z.string().nullable().optional(),
  pptg25WholesalePrice: z.string().nullable().optional(),
  bdWholesaleRetail24: z.string().nullable().optional(),
  bdWholesaleRetail25: z.string().nullable().optional(),
  adjusted: z.string().nullable().optional(),
  inc2425Pct: z.string().nullable().optional(),
  bdMargin: z.string().nullable().optional(),
  bdMarginPct: z.string().nullable().optional(),
  landedCost: z.string().nullable().optional(),
  landedPlusBdFees: z.string().nullable().optional(),
  margin: z.string().nullable().optional(),
  srpMargin: z.string().nullable().optional(),
  tariffPct: z.string().nullable().optional(),
  tariffAmt: z.string().nullable().optional(),
  dutyPct: z.string().nullable().optional(),
  dutyAmt: z.string().nullable().optional(),
  freight: z.string().nullable().optional(),
  freightAlt: z.string().nullable().optional(),
  loadPct: z.string().nullable().optional(),
  bdLicenseFeePct: z.string().nullable().optional(),
  asiaMarginPct: z.string().nullable().optional(),
  bdFee: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const skuSchema = z.object({
  sku: z.string().min(1),
  description: z.string().nullable().optional(),
  productGroup: z.string().nullable().optional(),
  var1: z.string().nullable().optional(),
  var2: z.string().nullable().optional(),
  status: z.enum(["active", "done", "new_model", "missing", "discontinued"]).optional(),
  sortOrder: z.number().optional(),
  // Sourcing fields
  supplier: z.string().nullable().optional(),
  htsCode: z.string().nullable().optional(),
  sourceStatus: z.string().nullable().optional(),
  isBd: z.string().nullable().optional(),
  salesQty2024Ytd: z.string().nullable().optional(),
  avgPrice2024Ytd: z.string().nullable().optional(),
  salesAmt2024Ytd: z.string().nullable().optional(),
  cartonL: z.string().nullable().optional(),
  cartonW: z.string().nullable().optional(),
  cartonH: z.string().nullable().optional(),
  grossWtKg: z.string().nullable().optional(),
  netWtKg: z.string().nullable().optional(),
  pcsPerCarton: z.string().nullable().optional(),
  grossWtPerUnit: z.string().nullable().optional(),
  netWtPerUnit: z.string().nullable().optional(),
  packingType: z.string().nullable().optional(),
  cartonCount: z.number().nullable().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  dealerPricing: dealerPricingRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── SKU CRUD ───────────────────────────────────────────────────────────────
  skus: router({
    list: publicProcedure
      .input(
        z.object({
          search: z.string().optional(),
          productGroup: z.string().optional(),
          status: z.string().optional(),
          brand: z.string().optional(),
          sourceStatus: z.string().optional(),
          supplier: z.string().optional(),
          limit: z.number().min(1).max(500).optional(),
          offset: z.number().min(0).optional(),
          ids: z.array(z.number()).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getSkuList(input);
      }),

    sourceStatuses: publicProcedure.query(async () => {
      return getSourceStatuses();
    }),

    suppliers: publicProcedure.query(async () => {
      return getSuppliers();
    }),

    cartonDetails: publicProcedure
      .input(z.object({ skuId: z.number() }))
      .query(async ({ input }) => {
        return getCartonDetailsBySkuId(input.skuId);
      }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const result = await getSkuById(input.id);
        if (!result) throw new TRPCError({ code: "NOT_FOUND" });
        return result;
      }),

    productGroups: publicProcedure.query(async () => {
      return getProductGroups();
    }),

    create: publicProcedure
      .input(z.object({ sku: skuSchema, pricing: pricingSchema.optional() }))
      .mutation(async ({ input }) => {
        const result = await createSku(input.sku, input.pricing as any);
        if (result) {
          await recordVersion({
            skuId: result.sku.id,
            userId: null,
            changeType: "create",
            changeDescription: `Created SKU ${input.sku.sku}`,
            previousData: null,
            newData: result as any,
            affectedSkuIds: [result.sku.id] as any,
          });
        }
        return result;
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          sku: skuSchema.partial().optional(),
          pricing: pricingSchema.optional(),
        })
      )
      .mutation(async ({ input }) => {
        const prev = await getSkuById(input.id);
        if (!prev) throw new TRPCError({ code: "NOT_FOUND" });

        // Auto-compute margins if landed cost or retail prices are being updated
        let pricingWithMargins = input.pricing as any;
        if (input.pricing) {
          const merged = { ...prev.pricing, ...input.pricing };
          const computed = computeMargins(merged);
          pricingWithMargins = {
            ...input.pricing,
            ...(computed.bdMargin !== null && !input.pricing.bdMargin ? { bdMargin: String(computed.bdMargin.toFixed(2)) } : {}),
            ...(computed.bdMarginPct !== null && !input.pricing.bdMarginPct ? { bdMarginPct: String(computed.bdMarginPct.toFixed(4)) } : {}),
            ...(computed.inc2425Pct !== null && !input.pricing.inc2425Pct ? { inc2425Pct: String(computed.inc2425Pct.toFixed(4)) } : {}),
          };
        }

        const result = await updateSku(input.id, input.sku as any, pricingWithMargins);
        await recordVersion({
          skuId: input.id,
          userId: null,
          changeType: "update",
          changeDescription: `Updated SKU ${prev.sku.sku}`,
          previousData: prev as any,
          newData: result as any,
          affectedSkuIds: [input.id] as any,
        });
        return result;
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const prev = await getSkuById(input.id);
        if (!prev) throw new TRPCError({ code: "NOT_FOUND" });
        await recordVersion({
          skuId: input.id,
          userId: null,
          changeType: "delete",
          changeDescription: `Deleted SKU ${prev.sku.sku}`,
          previousData: prev as any,
          newData: null,
          affectedSkuIds: [input.id] as any,
        });
        await deleteSku(input.id);
        return { success: true };
      }),
  }),

  // ─── AI Prompt ──────────────────────────────────────────────────────────────
  ai: router({
    prompt: publicProcedure
      .input(
        z.object({
          prompt: z.string().min(1).max(2000),
          preview: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ input }) => {

        // Fetch all SKUs for context
        const { items } = await getSkuList({ limit: 500 });
        const skuSummary = items.map(item => ({
          id: item.sku.id,
          sku: item.sku.sku,
          description: item.sku.description,
          productGroup: item.sku.productGroup,
          var1: item.sku.var1,
          var2: item.sku.var2,
          status: item.sku.status,
          srp2023: item.pricing?.srp2023,
          srp2024: item.pricing?.srp2024,
          map: item.pricing?.map,
          bdWholesaleRetail24: item.pricing?.bdWholesaleRetail24,
          bdWholesaleRetail25: item.pricing?.bdWholesaleRetail25,
          fob26Costing: item.pricing?.fob26Costing,
          factoryCost: item.pricing?.factoryCost,
          landedCost: item.pricing?.landedCost,
          pptg25WholesalePrice: item.pricing?.pptg25WholesalePrice,
          adjusted: item.pricing?.adjusted,
        }));

        const systemPrompt = `You are a SKU pricing assistant for PoolPartsToGo (poolpartstogo.com). 
You help manage SKU costing data. Given a natural language instruction, you must:
1. Identify which SKUs are affected
2. Determine what pricing fields need to change
3. Calculate the new values

Available pricing fields:
- srp2023, srp2024 (Suggested Retail Price)
- map (Minimum Advertised Price)
- comps2024 (2024 competitor pricing)
- srp2024Amzn (Amazon SRP 2024)
- wholesalePoolCity (Wholesale Pool City)
- bdWholesaleMarginPct (B&D wholesale margin %)
- fob26Costing (FOB 2026 costing)
- factoryCost (factory cost)
- pptg25WholesalePrice (PPTG 2025 wholesale price)
- bdWholesaleRetail24 (BD wholesale retail 2024)
- bdWholesaleRetail25 (BD wholesale retail 2025)
- adjusted (adjusted price)
- landedCost (landed cost)
- landedPlusBdFees (landed + BD fees)
- margin (margin)

Product groups: Heat Pumps, Above-Ground Pumps, In-Ground Pumps, Sand Filters, Hose Kits, Filter Tanks

Return a JSON object with this exact structure:
{
  "summary": "Human-readable description of what will be changed",
  "affectedCount": number,
  "changes": [
    {
      "skuId": number,
      "sku": "SKU code",
      "description": "product description",
      "field": "pricing field name",
      "oldValue": "current value or null",
      "newValue": "new calculated value as string"
    }
  ]
}

Rules:
- newValue must be a string representation of a decimal number (e.g. "149.99")
- For percentage increases: multiply current value by (1 + pct/100)
- Only include SKUs where you have enough data to make the change
- If a value is null/missing, skip that SKU for that field unless creating from scratch
- Group multiple field changes for the same SKU as separate entries in changes array`;

        const userMessage = `Current SKU data (${skuSummary.length} SKUs):
${JSON.stringify(skuSummary, null, 2)}

Instruction: ${input.prompt}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pricing_changes",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  affectedCount: { type: "integer" },
                  changes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        skuId: { type: "integer" },
                        sku: { type: "string" },
                        description: { type: "string" },
                        field: { type: "string" },
                        oldValue: { type: ["string", "null"] },
                        newValue: { type: "string" },
                      },
                      required: ["skuId", "sku", "description", "field", "oldValue", "newValue"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "affectedCount", "changes"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : null;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned no response" });

        const parsed = JSON.parse(content);

        // If preview mode, just return the changes without applying
        if (input.preview) {
          return { ...parsed, applied: false };
        }

        // Apply the changes
        const changesBySkuId = new Map<number, Record<string, string>>();
        for (const change of parsed.changes) {
          if (!changesBySkuId.has(change.skuId)) {
            changesBySkuId.set(change.skuId, {});
          }
          changesBySkuId.get(change.skuId)![change.field] = change.newValue;
        }

        const affectedSkuIds: number[] = [];
        for (const [skuId, pricingUpdates] of Array.from(changesBySkuId.entries())) {
          const prev = await getSkuById(skuId);
          const merged = { ...prev?.pricing, ...pricingUpdates };
          const computed = computeMargins(merged);
          const finalUpdates = {
            ...pricingUpdates,
            ...(computed.bdMargin !== null ? { bdMargin: String(computed.bdMargin.toFixed(2)) } : {}),
            ...(computed.bdMarginPct !== null ? { bdMarginPct: String(computed.bdMarginPct.toFixed(4)) } : {}),
            ...(computed.inc2425Pct !== null ? { inc2425Pct: String(computed.inc2425Pct.toFixed(4)) } : {}),
          };
          await updateSku(skuId, undefined, finalUpdates as any);
          affectedSkuIds.push(skuId);
        }

        // Record a single version entry for the bulk AI change
        if (affectedSkuIds.length > 0) {
          await recordVersion({
            skuId: affectedSkuIds[0],
            userId: null,
            changeType: "ai_prompt",
            changeDescription: parsed.summary,
            promptText: input.prompt,
            previousData: null,
            newData: null,
            affectedSkuIds: affectedSkuIds as any,
          });
        }

                return { ...parsed, applied: true };
      }),
    filter: publicProcedure
      .input(z.object({ prompt: z.string().min(1).max(2000) }))
      .mutation(async ({ input }) => {
        const { items } = await getSkuList({ limit: 500 });
        const skuSummary = items.map(item => ({
          id: item.sku.id,
          sku: item.sku.sku,
          description: item.sku.description,
          productGroup: item.sku.productGroup,
          bdMarginPct: item.pricing?.bdMarginPct,
          srp2024: item.pricing?.srp2024,
          map: item.pricing?.map,
          landedCost: item.pricing?.landedCost,
          status: item.sku.status,
        }));
        const systemPrompt = `You are a SKU data filter assistant. Given a list of SKUs and a filter request, return the IDs of matching SKUs and a brief explanation.\n\nRespond with JSON matching this schema:\n{\n  "matchingIds": [array of SKU id numbers],\n  "explanation": "brief description of what was matched"\n}`;
        const userMsg = `SKU Data (${skuSummary.length} items):\n${JSON.stringify(skuSummary.slice(0, 300))}\n\nFilter request: ${input.prompt}`;
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMsg },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "filter_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  matchingIds: { type: "array", items: { type: "number" } },
                  explanation: { type: "string" },
                },
                required: ["matchingIds", "explanation"],
                additionalProperties: false,
              },
            },
          },
        });
        const rawContent = resp.choices[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : null;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No response from AI" });
        return JSON.parse(content) as { matchingIds: number[]; explanation: string };
      }),
  }),
  // ─── Version History ────────────────────────────────────────────────────────
  versions: router({
    list: publicProcedure
      .input(
        z.object({
          skuId: z.number().optional(),
          search: z.string().optional(),
          changeType: z.string().optional(),
          limit: z.number().min(1).max(200).optional(),
          offset: z.number().min(0).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return getVersionHistory(input);
      }),

    revert: publicProcedure
      .input(z.object({ versionId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const { skuVersions } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const [version] = await db
          .select()
          .from(skuVersions)
          .where(eq(skuVersions.id, input.versionId))
          .limit(1);

        if (!version) throw new TRPCError({ code: "NOT_FOUND" });
        if (!version.previousData) throw new TRPCError({ code: "BAD_REQUEST", message: "No previous data to revert to" });

        const prev = version.previousData as any;
        await updateSku(version.skuId, prev.sku, prev.pricing);

        await recordVersion({
          skuId: version.skuId,
          userId: null,
          changeType: "revert",
          changeDescription: `Reverted to version from ${version.createdAt}`,
          previousData: null,
          newData: prev,
          affectedSkuIds: [version.skuId] as any,
        });

        return { success: true };
      }),
  }),

  // ─── Import / Export ────────────────────────────────────────────────────────
  import: router({
    csv: publicProcedure
      .input(
        z.object({
          rows: z.array(
            z.object({
              sku: z.string(),
              description: z.string().optional(),
              productGroup: z.string().optional(),
              var1: z.string().optional(),
              var2: z.string().optional(),
              status: z.enum(["active", "done", "new_model", "missing", "discontinued"]).optional(),
              srp2023: z.string().optional(),
              srp2024: z.string().optional(),
              map: z.string().optional(),
              comps2024: z.string().optional(),
              srp2024Amzn: z.string().optional(),
              wholesalePoolCity: z.string().optional(),
              bdWholesaleMarginPct: z.string().optional(),
              fob26Costing: z.string().optional(),
              factoryCost: z.string().optional(),
              pptg25WholesalePrice: z.string().optional(),
              bdWholesaleRetail24: z.string().optional(),
              bdWholesaleRetail25: z.string().optional(),
              adjusted: z.string().optional(),
              landedCost: z.string().optional(),
              landedPlusBdFees: z.string().optional(),
              margin: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const rows = input.rows.map(row => ({
          sku: {
            sku: row.sku,
            description: row.description ?? null,
            productGroup: row.productGroup ?? null,
            var1: row.var1 ?? null,
            var2: row.var2 ?? null,
            status: (row.status ?? "active") as any,
          },
          pricing: {
            srp2023: row.srp2023 ?? null,
            srp2024: row.srp2024 ?? null,
            map: row.map ?? null,
            comps2024: row.comps2024 ?? null,
            srp2024Amzn: row.srp2024Amzn ?? null,
            wholesalePoolCity: row.wholesalePoolCity ?? null,
            bdWholesaleMarginPct: row.bdWholesaleMarginPct ?? null,
            fob26Costing: row.fob26Costing ?? null,
            factoryCost: row.factoryCost ?? null,
            pptg25WholesalePrice: row.pptg25WholesalePrice ?? null,
            bdWholesaleRetail24: row.bdWholesaleRetail24 ?? null,
            bdWholesaleRetail25: row.bdWholesaleRetail25 ?? null,
            adjusted: row.adjusted ?? null,
            landedCost: row.landedCost ?? null,
            landedPlusBdFees: row.landedPlusBdFees ?? null,
            margin: row.margin ?? null,
          },
        }));

        const result = await bulkImportSkus(rows);
        return result;
      }),
  }),

  export: router({
    csv: publicProcedure
      .input(
        z.object({
          productGroup: z.string().optional(),
          status: z.string().optional(),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        const { items } = await getSkuList({ ...input, limit: 5000 });
        return items;
      }),
  }),

  // ─── Channel Pricing ───────────────────────────────────────────────────────────────────
  channels: router({
    list: publicProcedure
      .input(z.object({ type: z.enum(['online', 'wholesale']).optional() }).optional())
      .query(async ({ input }) => {
        return getChannels(input?.type);
      }),
  }),

  channelPrices: router({
    matrix: publicProcedure
      .input(
        z.object({
          channelType: z.enum(['online', 'wholesale']),
          search: z.string().optional(),
          productGroup: z.string().optional(),
          supplier: z.string().optional(),
          limit: z.number().min(1).max(500).optional(),
          offset: z.number().min(0).optional(),
        })
      )
      .query(async ({ input }) => {
        return getChannelPricingMatrix(input.channelType, {
          search: input.search,
          productGroup: input.productGroup,
          supplier: input.supplier,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    bySku: publicProcedure
      .input(z.object({ skuId: z.number() }))
      .query(async ({ input }) => {
        return getChannelPricesBySku(input.skuId);
      }),

    upsert: publicProcedure
      .input(
        z.object({
          skuId: z.number(),
          channelId: z.number(),
          price: z.string().nullable().optional(),
          floorPrice: z.string().nullable().optional(),
          ceilingPrice: z.string().nullable().optional(),
          targetMarginPct: z.string().nullable().optional(),
          competitorPrice: z.string().nullable().optional(),
          competitorUrl: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          effectiveDate: z.date().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Fetch landed cost for margin calculation
        const skuData = await getSkuById(input.skuId);
        const landedCost = skuData?.pricing?.landedCost ?? null;
        return upsertChannelPrice({ ...input, landedCost });
      }),

    applyRule: publicProcedure
      .input(
        z.object({
          channelId: z.number(),
          targetMarginPct: z.number().min(0).max(1),
        })
      )
      .mutation(async ({ input }) => {
        return applyChannelPricingRule(input.channelId, input.targetMarginPct);
      }),

    exportSheet: publicProcedure
      .input(
        z.object({
          channelId: z.number(),
          productGroup: z.string().optional(),
          brand: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return exportChannelPriceSheet(input.channelId, {
          productGroup: input.productGroup,
          brand: input.brand,
        });
      }),

    bulkImportCsv: publicProcedure
      .input(
        z.object({
          rows: z.array(z.object({
            skuCode: z.string(),
            channelName: z.string(),
            price: z.string(),
            floorPrice: z.string().optional(),
            ceilingPrice: z.string().optional(),
            targetMarginPct: z.string().optional(),
            notes: z.string().optional(),
          }))
        })
      )
      .mutation(async ({ input }) => {
        return bulkImportChannelPrices(input.rows);
      }),

    marginAlerts: publicProcedure
      .input(z.object({
        channelId: z.number().optional(),
        thresholdPct: z.number().min(0).max(1).optional(),
      }).optional())
      .query(async ({ input }) => {
        return getMarginAlerts(input?.channelId, input?.thresholdPct);
      }),

    priceHistory: publicProcedure
      .input(z.object({
        skuId: z.number(),
        channelId: z.number().optional(),
        limit: z.number().min(1).max(200).optional(),
        offset: z.number().min(0).optional(),
      }))
      .query(async ({ input }) => {
        return getChannelPriceHistory(input.skuId, {
          channelId: input.channelId,
          limit: input.limit,
          offset: input.offset,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
