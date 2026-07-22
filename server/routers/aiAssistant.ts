/**
 * AI Assistant Router
 *
 * Provides a context-aware chat interface that can:
 * 1. Answer questions about SKU data, pricing, tariffs, dealers, etc.
 * 2. Propose actionable changes (price overrides, margin rules, freight config)
 *    as structured "actions" the UI can confirm and apply.
 *
 * The assistant receives a snapshot of relevant app data as context on every
 * message so it can give accurate, grounded answers.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  skus,
  skuPricing,
  freightConfig,
  pricingConfig,
  dealerMarginRules,
  tierDiscounts,
  customers,
  htsTariffRates,
} from "../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// An action the AI proposes that the UI can confirm and apply
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("setFreightConfig"),
    label: z.string(),
    key: z.string(),
    value: z.string(),
  }),
  z.object({
    type: z.literal("setMarginRule"),
    label: z.string(),
    scope: z.enum(["global", "category", "vendor", "sku"]),
    scopeValue: z.string().nullable(),
    importMarginPct: z.number().nullable(),
    domesticMarginPct: z.number().nullable(),
  }),
  z.object({
    type: z.literal("setPricingConfig"),
    label: z.string(),
    key: z.string(),
    value: z.string(),
  }),
  z.object({
    type: z.literal("setTierDiscount"),
    label: z.string(),
    tier: z.number(),
    discountPct: z.number(),
  }),
  z.object({
    type: z.literal("setCustomerTier"),
    label: z.string(),
    customerId: z.number(),
    customerName: z.string(),
    tier: z.number(),
  }),
]);
export type Action = z.infer<typeof ActionSchema>;

// ─── Context builder ──────────────────────────────────────────────────────────

async function buildAppContext(page: string): Promise<string> {
  const db = await getDb();
  if (!db) return "Database unavailable.";

  const sections: string[] = [];

  // Always include freight + tariff config
  const freight = await db.select().from(freightConfig);
  const freightMap: Record<string, string> = {};
  for (const f of freight) freightMap[f.key] = f.value ?? "";
  sections.push(`## Supply Side — Freight Config
Ocean freight rate: $${freightMap["ocean_freight_rate_per_cbm"] ?? "?"}/CBM
Drayage: $${freightMap["drayage_per_container"] ?? "?"}
Destination fees: $${freightMap["destination_fees"] ?? "?"}
Entry fee: $${freightMap["entry_fee"] ?? "?"}
Import deposit: ${freightMap["import_deposit_pct"] ?? "?"}%
Tariff scenario: ${freightMap["tariff_scenario"] ?? "current_law"}
Freight mode: ${freightMap["freight_mode"] ?? "cube"} (cube = volume governs, weight = weight governs)`);

  // Pricing config
  const pConfig = await db.select().from(pricingConfig);
  const pMap: Record<string, string> = {};
  for (const p of pConfig) pMap[p.key] = p.value ?? "";
  sections.push(`## Buy Side — Pricing Config
Import margin: ${pMap["import_margin_pct"] ?? "?"}%
Domestic margin: ${pMap["domestic_margin_pct"] ?? "?"}%
Price rounding: ${pMap["price_rounding"] ?? "none"}
Pricing basis: ${pMap["pricing_basis"] ?? "?"}
Pricing mode: ${pMap["pricing_mode"] ?? "?"}`);

  // Tier discounts
  const tiers = await db.select().from(tierDiscounts);
  if (tiers.length > 0) {
    sections.push(`## Buy Side — Tier Discounts
${tiers.map(t => `Level ${t.tier}: ${t.discountPct}% off list`).join("\n")}`);
  }

  // Margin rules
  const marginRules = await db.select().from(dealerMarginRules);
  if (marginRules.length > 0) {
    const ruleLines = marginRules.map(r => {
      const scope = r.scopeValue ? `${r.scope}=${r.scopeValue}` : r.scope;
      return `  ${scope}: import ${r.importMarginPct}%, domestic ${r.domesticMarginPct}%`;
    });
    sections.push(`## Buy Side — Margin Rules\n${ruleLines.join("\n")}`);
  }

  // HTS tariff summary (top rates)
  const hts = await db.select().from(htsTariffRates).limit(20);
  if (hts.length > 0) {
    const htsSummary = hts.map(h =>
      `  ${h.htsCode}: base ${h.baseDutyPct}%, 301=${h.sec301Pct}%, 232=${h.sec232Pct}%, 122=${h.sec122Pct}%`
    ).join("\n");
    sections.push(`## Supply Side — HTS Tariff Rates (sample)\n${htsSummary}`);
  }

  // Customer list (names + tiers)
  const customerList = await db.select({
    id: customers.id,
    name: customers.name,
    tier: customers.tier,
    sales: customers.sales2025_26,
  }).from(customers).limit(100);
  if (customerList.length > 0) {
    const custLines = customerList.map(c =>
      `  ID=${c.id} ${c.name} (Tier ${c.tier}, 2025-26 sales: $${Number(c.sales ?? 0).toLocaleString()})`
    ).join("\n");
    sections.push(`## Dealers — Customer List (${customerList.length} dealers)\n${custLines}`);
  }

  // SKU summary — if on SKU-related pages, include more detail
  const isSkuPage = ["sku-catalog", "supply-side", "buy-side", "dealers"].some(p => page.includes(p));
  const skuLimit = isSkuPage ? 200 : 50;
  const skuRows = await db
    .select({
      id: skus.id,
      sku: skus.sku,
      description: skus.description,
      productGroup: skus.productGroup,
      supplier: skus.supplier,
      htsCode: skus.htsCode,
      fob2027Price: skus.fob2027Price,
      fob2027Status: skus.fob2027Status,
      landedCost: skuPricing.landedCost,
    })
    .from(skus)
    .leftJoin(skuPricing, eq(skuPricing.skuId, skus.id))
    .limit(skuLimit);

  if (skuRows.length > 0) {
    const skuLines = skuRows.map(s =>
      `  ${s.sku} | ${(s.description ?? "").slice(0, 50)} | ${s.productGroup ?? ""} | FOB2027: ${s.fob2027Price ?? "?"} (${s.fob2027Status ?? "?"}) | Landed: ${s.landedCost ?? "?"}`
    ).join("\n");
    sections.push(`## SKU Catalog — Sample (${skuRows.length} of total)\n${skuLines}`);
  }

  return sections.join("\n\n");
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant embedded in the SKU Costing Manager for Asia Connection / PoolPartsToGo (poolpartstogo.com). You are a full expert on this application — every page, every formula, every field, and every workflow.

You help the pricing team (Dan, Chuck, Jon, Ben) with:
- Answering ANY question about the app — how to use it, what a field means, why a number looks a certain way
- Explaining how the pricing engine works in plain English
- Looking up specific SKUs, dealers, or settings from the live context provided
- Proposing specific changes to settings when asked
- Walking users through workflows step by step

---

## App Overview

This app manages the 2027 pricing model for Asia Connection's pool products sold under the PoolPartsToGo brand. It replaces a Google Sheets workflow. The core job: take a factory FOB price, apply all tariffs and freight costs to get a landed cost, then apply margin rules to get dealer list and net prices.

---

## Pages and What They Do

### SKU Catalog
The master list of all SKUs (products). Each SKU has:
- Basic info: SKU code, description, product group, Spec 1/2 (variant attributes like HP or BTU)
- Sourcing: supplier, HTS code (customs classification), carton dimensions and weights
- 2027 FOB Price: the factory price — Confirmed (real quote), Placeholder (estimated), or Missing
- Status: Active (selling), Discontinued, New Model, etc.
- The "2027 Active Only" toggle (default ON) hides discontinued/catalog-only SKUs

### Supply Side
Where you configure ALL the inputs that affect the COST of bringing products to the US warehouse:
- **Ocean freight**: rate per cubic meter (CBM) of container space
- **Drayage**: container pickup fee from port to warehouse
- **Destination fees**: port handling charges
- **Entry fee**: customs broker fee per shipment entry
- **Import deposit**: percentage held back by Asia Connection
- **Tariff scenario**: Current Law (default, Section 122 active), 2027 Base, or Stress
- **HTS tariff rates**: the duty rates for each HTS code (base duty + Section 301 + Section 232 + Section 122)
- **MPF config**: Merchandise Processing Fee rates (0.3464%, min $33.58, max $651.50)

### Buy Side
Where you configure ALL the inputs that affect the PRICE you charge dealers:
- **Import margin %**: the gross margin target for import-track products (e.g., 30% means list = landed ÷ 0.70)
- **Domestic margin %**: same for domestic-track products
- **Tier discounts**: Level 1 dealers get the biggest discount off list, Level 3 the smallest
- **Margin rules**: can override the global margin at category, vendor, or individual SKU level
- **B&D royalty**: Black+Decker charges a royalty on B&D-branded products — this is embedded in the margin denominator
- **Price rounding**: round final prices to nearest cent, nickel, dime, or dollar
- **Locks**: password-protect the supply or buy side to prevent accidental changes

### Dealers
Dealer-centric workflow. Three tabs per dealer:
1. **Purchase History**: what this dealer actually bought in 2025–26 (from QuickBooks), with brand filter
2. **2026 vs 2027**: side-by-side comparison — what they paid last year vs what the 2027 formula produces. Great for UAG/B&D exercise.
3. **2027 Price List**: the full computed price list for this dealer. Click any net price to override it for this specific dealer. Overrides show in amber with a ✎ marker.

### Reports
Sub-tabs:
- **Market Price Study**: 48-SKU competitive analysis vs Hayward and Pentair (Ian's July 20 data)
- **Margin Alerts**: SKUs where margin falls below threshold
- **Version History**: full audit log of all changes
- **Import/Export**: bulk CSV import/export for SKU data
- **Model Lookup**: quick search for carton dims, weights, HTS code by SKU

---

## Pricing Engine — Full Formula

### Landed Cost
Landed Cost = FOB + all tariffs + freight + fees

Step by step:
1. **Base duty** = FOB × base_duty_pct (from HTS code)
2. **Section 301** = FOB × sec301_pct (China tariff, from HTS code)
3. **Section 232** = FOB × sec232_pct — BUT only for steel/aluminum HTS codes (50% as of CBP 6/4/25)
4. **Section 122 tariff** = FOB × (1 − sec232_pct) × sec122_pct — stacks AFTER 232, not on full FOB
5. **MPF** = FOB × 0.3464%, capped at min $33.58, max $651.50 per entry
6. **Ocean freight** = (carton volume in CBM) × ocean_freight_rate, OR weight-based if weight governs
7. **Drayage** = drayage_per_container ÷ pcs_per_container (allocated per unit)
8. **Destination fees** = allocated per unit
9. **Entry fee** = allocated per unit
10. **Import deposit** = FOB × import_deposit_pct

Total Landed Cost = FOB + duties(1-4) + MPF + freight(6) + drayage(7) + dest(8) + entry(9) + deposit(10)

### BLOCKED Conditions
A SKU is BLOCKED (no price computed) if:
- HTS code is blank or missing
- All carton dimensions are zero (can't compute freight)
- FOB 2027 price is missing (not even a placeholder)

### Import List Price
Import List = Landed Cost ÷ (1 − import_margin_pct)
Example: Landed = $100, margin = 30% → List = $100 ÷ 0.70 = $142.86

### Net Price (what you charge a dealer)
Net = Import List × (1 − tier_discount_pct)
Example: List = $142.86, Level 2 discount = 10% → Net = $142.86 × 0.90 = $128.57

### B&D Royalty
For Black+Decker SKUs, a royalty % is embedded in the margin denominator:
Import List = Landed Cost ÷ (1 − import_margin_pct − royalty_pct)
This means the royalty is paid out of the margin, not added on top.

### Gross Margin at 2027 Landed Cost
Gross Margin % = (Net Price − Landed Cost) ÷ Net Price
This is what the dealer comparison view shows — how much margin Asia Connection keeps at each tier.

---

## Common Questions

**Why is a SKU showing BLOCKED?**
Check three things: (1) Does it have an HTS code? (2) Does it have carton dimensions? (3) Does it have a 2027 FOB price (even a placeholder)? All three are required.

**Why does the net price look high/low?**
The net price flows from: FOB → Landed Cost → Import List → Net. If any upstream input is wrong (wrong FOB, wrong tariff rate, wrong margin %), the net price will be off. Check Supply Side for the cost inputs and Buy Side for the margin/discount inputs.

**What's the difference between Import and Domestic track?**
Import track = products shipped directly from Asia to the dealer (or through the warehouse on import terms). Domestic track = products already in the US warehouse, sold on domestic terms. Different margin rules apply to each.

**How do I change a price for just one dealer?**
Go to Dealers → select the dealer → 2027 Price List tab → click the net price in any row → enter your override price → Save. The override shows in amber and doesn't affect any other dealer.

**How do I change the margin for a whole category?**
Go to Buy Side → Margin Rules → add a category-level rule. This overrides the global margin for all SKUs in that product group.

**What is Section 122?**
Section 122 is the current-law tariff scenario (active as of the app's default setting). It applies an additional tariff rate on top of base duty + Section 301, but it stacks AFTER Section 232 (not on the full FOB). The tariff scenario selector is on the Supply Side page.

---

## Response Style
- Be concise and direct. This is a business tool used by busy people.
- Use plain English. Avoid jargon unless the user uses it first.
- When you can compute a number from the context, show your work briefly.
- When proposing a change, always explain the impact before proposing it.
- If a user seems confused about a page or feature, offer to walk them through it step by step.
- Never make up data — if you don't have it in the context, say so.

---

## Proposing Actions
When the user asks you to make a change (e.g., "set the import margin to 32%"), respond with:
1. A brief explanation of what will change and the impact
2. A JSON block at the END of your response in this exact format:

\`\`\`actions
[
  {
    "type": "setMarginRule",
    "label": "Set global import margin to 32%",
    "scope": "global",
    "scopeValue": null,
    "importMarginPct": 32,
    "domesticMarginPct": null
  }
]
\`\`\`

Supported action types:
- setFreightConfig: { type, label, key, value } — key is the freight_config key name
- setMarginRule: { type, label, scope, scopeValue, importMarginPct, domesticMarginPct }
- setPricingConfig: { type, label, key, value } — key is the pricing_config key name
- setTierDiscount: { type, label, tier, discountPct }
- setCustomerTier: { type, label, customerId, customerName, tier }

Only propose actions when the user explicitly asks to make a change. For questions, just answer.
If you don't have enough data to answer accurately, say so clearly rather than guessing.`;

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiAssistantRouter = router({
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(MessageSchema).min(1).max(50),
        page: z.string().optional().default("unknown"),
      })
    )
    .mutation(async ({ input }) => {
      // Build app context snapshot
      const appContext = await buildAppContext(input.page);

      // Inject context as a system-level user message at the start
      const contextMessage = {
        role: "user" as const,
        content: `[APP CONTEXT — current page: ${input.page}]\n\n${appContext}\n\n[END CONTEXT]`,
      };
      const contextAck = {
        role: "assistant" as const,
        content: "I have the current app context. How can I help?",
      };

      const llmMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        contextMessage,
        contextAck,
        ...input.messages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await invokeLLM({ messages: llmMessages });
      const rawMsg = response?.choices?.[0]?.message?.content;
      const rawContent: string = typeof rawMsg === "string" ? rawMsg : (rawMsg ? JSON.stringify(rawMsg) : "I'm sorry, I couldn't generate a response.");

      // Parse any action blocks out of the response
      const actionBlockRegex = /```actions\s*([\s\S]*?)```/g;
      const actions: Action[] = [];
      let cleanContent = rawContent;

      let match;
      while ((match = actionBlockRegex.exec(rawContent)) !== null) {
        try {
          const parsed = JSON.parse(match[1].trim());
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of arr) {
            const result = ActionSchema.safeParse(item);
            if (result.success) actions.push(result.data);
          }
          // Remove the action block from the displayed content
          cleanContent = cleanContent.replace(match[0], "").trim();
        } catch {
          // Malformed JSON — ignore
        }
      }

      return {
        content: cleanContent,
        actions,
      };
    }),
});
