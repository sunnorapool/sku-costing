/**
 * Market Prices Router
 * Serves Ian Allena's competitive price study (2026-07-20) — 48 top SKUs
 * with AC street prices vs. Hayward and Pentair comparables.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { marketPrices } from "../../drizzle/schema";
import { eq, like, isNotNull, sql } from "drizzle-orm";

export const marketPricesRouter = router({
  /** List all market price study rows, optionally filtered by category */
  list: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const offset = (input.page - 1) * input.pageSize;

      let query = db.select().from(marketPrices);
      const conditions: any[] = [];

      if (input.category) {
        conditions.push(eq(marketPrices.category, input.category));
      }
      if (input.search) {
        conditions.push(like(marketPrices.skuCode, `%${input.search}%`));
      }

      const rows = await db
        .select()
        .from(marketPrices)
        .where(conditions.length === 1 ? conditions[0] : conditions.length > 1 ? sql`${conditions[0]} AND ${conditions[1]}` : undefined)
        .orderBy(sql`sales_2025_26 DESC`)
        .limit(input.pageSize)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(marketPrices);

      return { rows, total: Number(count) };
    }),

  /** Get competitive reference data for a single SKU */
  getBySku: protectedProcedure
    .input(z.object({ skuCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const [row] = await db
        .select()
        .from(marketPrices)
        .where(eq(marketPrices.skuCode, input.skuCode))
        .limit(1);

      return row ?? null;
    }),

  /** Get distinct categories present in the study */
  getCategories: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const rows = await db
      .selectDistinct({ category: marketPrices.category })
      .from(marketPrices)
      .where(isNotNull(marketPrices.category))
      .orderBy(marketPrices.category);

    return rows.map((r) => r.category).filter(Boolean) as string[];
  }),

  /** Summary stats: avg dealer margin at T1 net vs street, by category */
  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const rows = await db.select().from(marketPrices).orderBy(sql`sales_2025_26 DESC`);

    const byCategory: Record<
      string,
      { count: number; totalDealerMarginPct: number; totalAcVsHayward: number; totalAcVsPentair: number; haywardCount: number; pentairCount: number }
    > = {};

    let totalDealerMargin = 0;
    let dealerMarginCount = 0;

    for (const r of rows) {
      const cat = r.category ?? "Other";
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, totalDealerMarginPct: 0, totalAcVsHayward: 0, totalAcVsPentair: 0, haywardCount: 0, pentairCount: 0 };
      }
      byCategory[cat].count++;

      // Dealer margin at T1 net: (street - T1net) / street
      const street = Number(r.ourStreetPrice);
      const t1net = Number(r.modelT1Net);
      if (street > 0 && t1net > 0) {
        const dealerMarginPct = (street - t1net) / street;
        byCategory[cat].totalDealerMarginPct += dealerMarginPct;
        totalDealerMargin += dealerMarginPct;
        dealerMarginCount++;
      }

      // AC vs Hayward: (hayward - our_street) / hayward
      const hayward = Number(r.haywardPrice);
      if (hayward > 0 && street > 0) {
        byCategory[cat].totalAcVsHayward += (hayward - street) / hayward;
        byCategory[cat].haywardCount++;
      }

      // AC vs Pentair: (pentair - our_street) / pentair
      const pentair = Number(r.pentairPrice);
      if (pentair > 0 && street > 0) {
        byCategory[cat].totalAcVsPentair += (pentair - street) / pentair;
        byCategory[cat].pentairCount++;
      }
    }

    const categories = Object.entries(byCategory).map(([cat, d]) => ({
      category: cat,
      skuCount: d.count,
      avgDealerMarginPct: d.count > 0 ? d.totalDealerMarginPct / d.count : null,
      avgAcVsHaywardPct: d.haywardCount > 0 ? d.totalAcVsHayward / d.haywardCount : null,
      avgAcVsPentairPct: d.pentairCount > 0 ? d.totalAcVsPentair / d.pentairCount : null,
    }));

    return {
      categories,
      overallAvgDealerMarginPct: dealerMarginCount > 0 ? totalDealerMargin / dealerMarginCount : null,
      skuCount: rows.length,
      studyDate: "2026-07-20",
    };
  }),
});
