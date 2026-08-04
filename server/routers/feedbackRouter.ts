/**
 * Feedback Router
 * Handles tester feedback submitted via the floating button or Ruben AI.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { feedback } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export const feedbackRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        testerName: z.string().max(128).optional(),
        page: z.string().max(128).optional(),
        type: z.enum(["bug", "suggestion", "question", "other"]).default("other"),
        message: z.string().min(1).max(4000),
        source: z.enum(["button", "ruben"]).default("button"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(feedback).values({
        testerName: input.testerName ?? null,
        page: input.page ?? null,
        type: input.type,
        message: input.message,
        source: input.source,
        resolved: 0,
      });

      // Send email notification to owner
      const typeLabel = input.type.charAt(0).toUpperCase() + input.type.slice(1);
      const fromLabel = input.testerName ? `from ${input.testerName}` : "(anonymous)";
      const pageLabel = input.page ? ` on ${input.page}` : "";
      await notifyOwner({
        title: `[SKU Tool] ${typeLabel} ${fromLabel}${pageLabel}`,
        content: `Type: ${typeLabel}\nFrom: ${input.testerName || "Anonymous"}\nPage: ${input.page || "Unknown"}\nSource: ${input.source}\n\n${input.message}`,
      }).catch(() => {}); // fire-and-forget — don't fail the submission if notification fails

      return { success: true };
    }),

  list: publicProcedure
    .input(
      z.object({
        showResolved: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await db
        .select()
        .from(feedback)
        .orderBy(desc(feedback.createdAt));
      if (input?.showResolved) return rows;
      return rows.filter((r) => r.resolved === 0);
    }),

  resolve: publicProcedure
    .input(z.object({ id: z.number(), resolved: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(feedback)
        .set({ resolved: input.resolved ? 1 : 0 })
        .where(eq(feedback.id, input.id));
      return { success: true };
    }),
});
