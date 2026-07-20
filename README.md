# SKU Costing Manager

Internal pricing and cost management tool for Asia Connection / poolpartstogo.com.

Built on React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM (MySQL/TiDB).

---

## What it does

- **SKU Costing** — Full catalog of 7,000+ SKUs with 2023/2024/2027 SRP, MAP, FOB costs, HTS codes, carton dims, and tariff classification. AI-assisted bulk pricing via natural language.
- **2027 Dealer Pricing** — Landed cost engine (FOB → ocean freight → tariffs → duties → MPF → load) with configurable margin rules, B&D royalty tiers, tariff scenario selector (Current Law / 2027 Base / Stress), and per-customer/per-SKU discount overrides. Exports price sheets.
- **Channel Pricing** — Online and wholesale channel price matrix with history tracking and bulk import.
- **Supply Side Settings** — Freight config, HTS tariff rates, customer gross margin analysis, market price study (competitive benchmarking vs Hayward/Pentair), price snapshots/version control.
- **Margin Alerts** — Automated digest of SKUs breaching margin thresholds.
- **Model Lookup** — Cross-reference tool for model numbers.
- **Import / Export** — CSV import/export for SKUs and channel prices.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Wouter |
| Backend | Express 4, tRPC 11, Drizzle ORM |
| Database | TiDB (MySQL-compatible) |
| Auth | Manus OAuth |
| Testing | Vitest |
| Build | Vite + esbuild |

---

## Development

```bash
pnpm install
pnpm dev          # starts dev server on :3000
pnpm test         # run vitest
pnpm check        # TypeScript check
```

### Schema changes

```bash
pnpm drizzle-kit generate   # generate migration SQL from schema.ts
# then apply via webdev_execute_sql or direct DB connection
```

---

## Key files

```
drizzle/schema.ts           ← All database tables
server/db.ts                ← Query helpers
server/routers.ts           ← Root tRPC router (auth, SKUs, channels, AI)
server/routers/
  dealerPricing.ts          ← 2027 dealer pricing engine
  supplySide.ts             ← Landed cost / freight / tariff engine
  marketPrices.ts           ← Competitive price study
client/src/pages/
  SKUTable.tsx              ← Main SKU catalog
  DealerPricing.tsx         ← 2027 pricing model UI
  SupplySideSettings.tsx    ← Supply side config + market study
  ChannelPricing.tsx        ← Channel price matrix
  MarginAlerts.tsx          ← Margin alert dashboard
  ModelLookup.tsx           ← Model cross-reference
  ImportExport.tsx          ← CSV import/export
  VersionHistory.tsx        ← Price snapshot history
```

---

## Pricing engine

The landed cost formula (per SKU, per container):

```
landed_cost = FOB
            + ocean_freight (weight-vs-cube, whichever governs)
            + drayage + destination_fees
            + import_deposit
            + Section 301 duty (HTS-specific rate)
            + Section 232 duty (50% for steel/AL, 0% otherwise)
            + Section 122 surcharge (on non-232 base; Current Law = active)
            + MPF (0.3464%, min $33.58, max $651.50 per entry)
```

Dealer list price:

```
list_price = landed_cost ÷ (1 − margin% − royalty%)
net_price  = list_price × (1 − discount%)
```

Margin rules resolve most-specific-wins: global → category → vendor → SKU.  
Discount rules resolve most-specific-wins: tier → customer → SKU×customer.

---

## Environment variables

All injected by the Manus platform — do not commit `.env` files.

- `DATABASE_URL` — MySQL/TiDB connection string
- `JWT_SECRET` — Session signing secret
- `VITE_APP_ID` — Manus OAuth app ID
- `BUILT_IN_FORGE_API_KEY` / `BUILT_IN_FORGE_API_URL` — Manus built-in APIs (LLM, storage)
