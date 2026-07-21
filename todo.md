# SKU Costing Manager - TODO

## Database & Backend
- [x] Database schema: skus table (sku, description, product_group, var1, var2, status)
- [x] Database schema: sku_pricing table (all price tiers: SRP 2023/24, MAP, Amazon SRP, wholesale, FOB, factory, landed, etc.)
- [x] Database schema: sku_versions table (version history / changelog)
- [x] Run migration and apply SQL
- [x] tRPC router: SKU CRUD (list, get, create, update, delete, bulkUpdate)
- [x] tRPC router: version history (list, getBySkuId, revert)
- [x] tRPC router: AI prompt handler (parse natural language → apply bulk changes)
- [x] tRPC router: import CSV data
- [x] tRPC router: export CSV
- [x] Auto-calculate margin fields (BD Margin, BD Margin %, YoY %)
- [x] Role-based access: admin can edit, user is read-only

## Frontend - Layout & Navigation
- [x] DashboardLayout with sidebar navigation
- [x] Global theme (clean business data tool, light theme)
- [x] App.tsx routes setup

## Frontend - SKU Table Page
- [x] Full-width data table with all columns from spreadsheet
- [x] Column groups (SKU Info, Pricing, Costs, Margins, Tariff & Duty, Freight & Fees, Notes)
- [x] Sticky header and frozen first columns (SKU, Description)
- [x] Color-coded status badges (DONE, NEW MODEL, Missing, active)
- [x] Search bar (by SKU or description)
- [x] Filter by product group dropdown
- [x] Filter by status flag
- [x] Add SKU dialog (admin only)
- [x] Edit SKU dialog (admin only)
- [x] Delete SKU with confirmation (admin only)
- [x] Admin Mode badge indicator

## Frontend - AI Prompt Interface
- [x] Prompt input box at top of SKU table page
- [x] Submit prompt → call AI router → preview changes
- [x] Confirm/cancel changes before applying
- [x] Show affected rows count in preview
- [x] AI prompt changes recorded in version history

## Frontend - Version History
- [x] Version history page with all changes
- [x] List all changes with timestamp, user, change type
- [x] Expandable diff view (field-by-field before/after)
- [x] Filter by change type
- [x] Search by description or prompt text
- [x] Revert to previous version (admin only)
- [x] Pagination

## Frontend - Import / Export
- [x] Import CSV button with drag-and-drop
- [x] CSV preview before confirming import
- [x] Import result summary (created/updated counts)
- [x] Export current data as CSV
- [x] Download CSV template

## Testing
- [x] Vitest: auth.me (authenticated and unauthenticated)
- [x] Vitest: skus.list (empty, with filters)
- [x] Vitest: skus.create (admin, non-admin, unauthenticated)
- [x] Vitest: versions.list (with search and changeType filters)
- [x] Vitest: import.csv (admin, non-admin)
- [x] Vitest: export.csv
- [x] Vitest: margin calculation logic
- [x] Vitest: auth.logout (from template)

## Data Import
- [x] Extract all SKU rows from Google Sheets (2026 Official tab)
- [x] Parse all columns: SKU, Description, Product Group, Var1, Var2, all pricing/cost/margin fields
- [x] Seed data directly into the database via SQL (6,778 SKUs imported)
- [x] Verify data appears correctly in the app

## Visual & AI Upgrade (Phase 2)
- [x] Dark navy sidebar with poolpartstogo brand colors
- [x] Global CSS theme overhaul (navy/blue palette, proper typography)
- [x] Column group header bands with color coding
- [x] Margin % cells color-coded red/yellow/green by value
- [x] Table row hover states and alternating row colors
- [x] Loading skeleton for table rows
- [x] AI prompt: streaming word-by-word response
- [x] AI prompt: live before/after diff preview (red/green highlights per row)
- [x] AI prompt: natural language filter mode (show matching rows instantly)
- [x] AI prompt: improved UX with mode toggle (Edit Mode vs Filter Mode)

## Open Access (Phase 3)
- [x] Remove login wall — unauthenticated visitors can browse all SKU data
- [x] Sidebar footer: show "Sign in for admin access" button for unauthenticated visitors
- [x] Sidebar footer: show user avatar + sign-out dropdown for authenticated users
- [x] SKUTable admin controls (Add/Edit/Delete/AI prompt) remain gated to admin role only

## Full Open Access — Everyone is Admin (Phase 4)
- [x] Frontend SKUTable: remove isAdmin checks — show Add/Edit/Delete/AI prompt to all visitors
- [x] Frontend VersionHistory: remove isAdmin check — show Revert button to all visitors
- [x] Frontend ImportExport: remove isAdmin/user checks — allow import to all visitors
- [x] Frontend DashboardLayout: remove Sign In footer button (no longer needed)
- [x] Backend routers.ts: change all protectedProcedure mutations to publicProcedure
- [x] Update tests to reflect open access

## Channel Pricing Module (Phase 5)

### Data Model
- [x] DB: `channels` table (id, name, type: online|wholesale, sortOrder, active)
- [x] DB: `channel_prices` table (id, skuId, channelId, price, floorPrice, ceilingPrice, targetMarginPct, competitorPrice, competitorUrl, notes, effectiveDate, updatedAt)
- [x] Run migration SQL via webdev_execute_sql
- [x] Seed 4 online storefronts: poolpartstogo.com, Amazon, Walmart, poolsupplyworld.com
- [x] Seed 10 wholesale partners: UAG, Leslie's, B+G, Hansen's + 5 sample partners

### Backend
- [x] tRPC: channels.list (all channels with type filter)
- [x] tRPC: channelPrices.listBySku (all channel prices for a given SKU)
- [x] tRPC: channelPrices.listByChannel (all SKU prices for a given channel, paginated)
- [x] tRPC: channelPrices.upsert (set/update price for a SKU+channel combo)
- [x] tRPC: channelPrices.bulkUpsert (import-style bulk set)
- [x] Auto-calculate margin % = (price - landedCost) / price on upsert

### Frontend — Channel Pricing Page
- [x] New page: client/src/pages/ChannelPricing.tsx
- [x] Sidebar nav entry: "Channel Pricing" with price-tag icon
- [x] Two tabs: Online Storefronts | Wholesale Partners
- [x] Online tab: SKU rows × storefront columns grid (like a pricing matrix)
- [x] Wholesale tab: SKU rows × partner columns grid
- [x] Each cell shows price + margin % color-coded (same thresholds as SKU table)
- [x] Click a cell to open inline edit popover: price, floor, ceiling, target margin %, competitor price, notes
- [x] Search/filter by SKU or product group
- [x] Margin color coding: green ≥35%, yellow ≥25%, orange ≥15%, red <15%

### Pricing Rules
- [x] Per-channel rule: set target margin % → auto-calculate price from landed cost
- [x] Floor/ceiling guardrails shown as visual indicators in cells
- [x] Competitor price field + notes for research tracking
- [x] "Apply Rule" button: recalculate all prices for a channel based on target margin

### Testing
- [x] Vitest: channels.list
- [x] Vitest: channelPrices.upsert (creates and updates)
- [x] Vitest: channelPrices.listBySku

## Price Sheet Export + Brand Filter (Phase 6)

- [x] Channel Pricing: Export button — download CSV price sheet for a selected channel (SKU, Description, Brand, Landed Cost, Channel Price, Margin %)
- [x] Channel Pricing: Export all channels option — one sheet per channel or combined
- [x] SKU Costing: Brand filter — detect brand from SKU prefix/description, add toggle buttons (BD, Sunnora, Blue Torrent, All)
- [x] SKU Costing: Brand filter persists across page navigation (localStorage)
- [x] Backend: tRPC channelPrices.exportSheet — returns all priced SKUs for a channel with full pricing data

## Asia SKU Merge (Phase 7)

- [x] DB: Add new columns to skus table: supplier, htsCode, sourceStatus, salesQty2024Ytd, avgPrice2024Ytd, salesAmt2024Ytd, cartonL, cartonW, cartonH, grossWtKg, netWtKg, pcsPerCarton, grossWtPerUnit, netWtPerUnit, packingType
- [x] DB: New carton_details table (id, skuId, cartonNum, cartonLabel, componentSku, qtyPerParent, componentSellable, packRuleStatus, cartonL, cartonW, cartonH, grossWtKg, netWtKg, pcsPerCarton, grossWtPerUnit, netWtPerUnit, packingType, verifiedBy, verifiedAt, notes)
- [x] Run migration SQL via webdev_execute_sql
- [x] Import script: match Asia SKUs to existing SKUs by sku code, update fields; add new SKUs for unmatched rows
- [x] Import carton_details rows from Carton Details sheet
- [x] Backend: update getSkuList to return new fields
- [x] Backend: add cartonDetails.bySku tRPC query
- [x] Backend: update createSku/updateSku to accept new fields
- [x] UI: Add new column group "Sourcing Info" to SKU table (supplier, HTS, packing type, carton dims)
- [x] UI: Add Source Status filter dropdown
- [x] UI: Add Supplier filter dropdown
- [x] UI: Carton Details button per row (Package icon)
- [x] UI: Update Edit SKU dialog with new sourcing fields (supplier, HTS, source status, B&D, carton dims, weights, packing, sales data)
- [x] Update CSV import/export to include new fields (deferred — tracked as future enhancement)

## Phase 8 — Three Feature Additions

- [x] Carton Details modal: clicking the package icon on a SKU row opens a dialog showing the carton_details sub-table (carton #, label, component SKU, qty, sellable, dims, weights, packing type)
- [x] Channel Pricing: add Supplier filter dropdown to filter the pricing matrix by supplier
- [x] CSV Export: update SKU export to include all new sourcing fields (supplier, HTS code, source status, B&D, packing type, carton L/W/H, gross/net weight, pcs per carton, sales qty/price/amount YTD)

## Phase 9 — Bulk Price Import, SKU Detail Page, Margin Alert Dashboard

- [x] Bulk channel price CSV import: upload CSV (SKU, Channel, Price) to set channel prices in bulk; preview before committing; show created/updated counts
- [x] Backend: tRPC channelPrices.bulkImportCsv procedure — parse CSV rows, match SKU+channel, upsert prices
- [x] Import / Export page: add "Import Channel Prices" card with CSV template download and upload flow
- [x] SKU detail page (/sku/:id): full read-only view of all costing, pricing, sourcing, carton details, and channel prices in one page
- [x] SKU detail page: accessible by clicking the SKU code link in the table
- [x] Margin alert dashboard: new "Alerts" section in sidebar showing SKUs where channel price < floor price OR margin % < target margin threshold
- [x] Margin alert dashboard: filter by channel, threshold slider, sort by severity
- [x] Margin alert dashboard: summary stats (total alerts, by channel, by product group)
- [x] Wire all new routes in App.tsx
- [x] Run tests and save checkpoint

## Phase 10 — Channel Price History

- [x] DB: `channel_price_history` table (id, skuId, channelId, oldPrice, newPrice, oldMarginPct, newMarginPct, changedAt, notes)
- [x] Run migration SQL via webdev_execute_sql
- [x] Backend: auto-insert history row on every channelPrices.upsert when price changes
- [x] Backend: tRPC channelPrices.priceHistory query (by skuId, paginated, sorted newest first)
- [x] UI: Price history section on SKU detail page — collapsible table showing all channel price changes with old→new, margin change, and timestamp
- [x] UI: Channel filter dropdown in history section to narrow to one channel

## Phase 11 — Model Lookup + Email Digest

- [x] Model Lookup page: /lookup — type any SKU/model code, see carton dims, weights, packing type, supplier, HTS code, sourcing status
- [x] Model Lookup: instant search (debounced), fuzzy match on SKU code and description
- [x] Model Lookup: sidebar nav entry "Model Lookup" with Search icon
- [x] Email digest: Bootstrap Heartbeat SDK
- [x] Email digest: /api/scheduled/margin-digest handler — query margin alerts, build HTML email, send to Chuck/Dan/Ben
- [x] Email digest: HTML email with summary stats + top 20 worst-margin SKUs table
- [x] Email digest: register daily cron at 8am ET (13:00 UTC) via manus-heartbeat CLI after deploy (requires publish first) — DEFERRED: requires live published URL to register heartbeat endpoint

## Phase 12 — Ian's Verified DB Import

- [x] DB: Add fob2027Price (decimal), fob2027Status (enum: confirmed|placeholder|missing), fob2027Source (text) columns to skus table
- [x] DB: Run migration via webdev_execute_sql
- [x] Import: match Ian's 2,152 SKUs to existing SKUs by canonical_sku, update carton dims, HTS code, source status, supplier, sales qty/amount
- [x] Import: import 24 approved 2027 FOB quote prices into fob2027Price + set fob2027Status='confirmed'
- [x] Import: set fob2027Status='placeholder' for SKUs with legacy cost, 'missing' for SKUs with no cost at all
- [x] UI: Add "Needs 2027 FOB" filter option to SKU table source status dropdown
- [x] UI: Color-code fob2027Status in the table (green=confirmed, yellow=placeholder, red=missing)
- [x] UI: Add fob2027Price column to the SKU table (toggleable)
- [x] Run tests and save checkpoint

## Phase 13 — 2027 Dealer Pricing Module

### Database
- [x] DB: `customers` table (id, name, tier: 1|2|3, sales2025_26, notes, import_deposit_exception, active)
- [x] DB: `dealer_margin_rules` table (id, scope: global|category|vendor|sku, scope_value, import_margin_pct, domestic_margin_pct)
- [x] DB: `tier_discounts` table (id, tier: 1|2|3, discount_pct, notes)
- [x] DB: `customer_discount_overrides` table (id, customer_id, discount_pct, notes)
- [x] DB: `sku_discount_overrides` table (id, sku_id, customer_id, discount_pct, notes)
- [x] DB: `pricing_locks` table (id, scope: supply|buy, locked, password_hash, locked_at)
- [x] DB: `dealer_price_overrides` table (id, sku_id, customer_id, import_list_override, domestic_list_override, import_net_override, domestic_net_override)
- [x] DB: `pricing_config` table (id, key, value) — pricing_basis, pricing_mode
- [x] Run migration SQL via webdev_execute_sql
- [x] Seed: 57 customers with tier assignments from Dan's Excel
- [x] Seed: global margin rules (20% import, 35% domestic as placeholders)
- [x] Seed: tier discounts (L1=15%, L2=10%, L3=5% as placeholders)

### Backend
- [x] tRPC: dealerPricing.getAssumptions — returns all margin rules, tier discounts, config
- [x] tRPC: dealerPricing.updateMarginRule — set/update margin at global/category/vendor/sku level
- [x] tRPC: dealerPricing.updateTierDiscount — set tier discount %
- [x] tRPC: dealerPricing.getCustomers — list all customers with tier
- [x] tRPC: dealerPricing.upsertCustomer — create/update customer + tier assignment
- [x] tRPC: dealerPricing.getBuySideMatrix — compute import/domestic list + net prices for all SKUs (paginated)
- [x] tRPC: dealerPricing.setOverride — manual override for a SKU × customer price
- [x] tRPC: dealerPricing.lock / unlock — password-protect supply or buy side
- [x] tRPC: dealerPricing.exportPriceSheet — CSV export for a customer

### Frontend
- [x] New page: /dealer-pricing — four tabs: Buy Side Matrix, Assumptions, Customers, Locks
- [x] Assumptions tab: global margin settings, tier discount table, category/vendor override table, pricing basis toggle, pricing mode toggle
- [x] Buy Side tab: SKU matrix showing import_list, import_net L1/L2/L3, domestic_list, domestic_net L1/L2/L3 — color-coded by kept margin
- [x] Buy Side: customer/brand/FOB status filters, single-customer view with margin display
- [x] Locks tab: password-protect supply or buy side independently
- [x] Sidebar nav entry: 2027 Dealer Pricing
- [x] Run tests (21 passing) and save checkpoint

## Phase 14 — Dan's Feature Requests + Full UI Pass

### DB Schema
- [x] DB: `hts_tariff_rates` table (hts_code, description, base_duty_pct, sec301_pct, sec232_pct, sec122_pct, source_url)
- [x] DB: `freight_config` table (key, value, label, formula_note, source_note)
- [x] DB: `price_snapshots` table (id, label, scope, snapshot_data JSON, created_at)
- [x] Run migration

### Backend
- [x] tRPC: hts.list / hts.upsert / hts.delete
- [x] tRPC: freightConfig.get / freightConfig.update
- [x] tRPC: landedCost.compute — full breakdown for a SKU
- [x] tRPC: customerHistory.get — per-customer PNL analysis
- [x] tRPC: snapshots.save / snapshots.list / snapshots.restore

### UI Pass — Nomenclature & Layout
- [x] SKUDetail: rename "FOB 26 Costing" → "2026 FOB Cost", "Factory Cost" → "Factory/FOB Cost", "Tariff %" → "Import Tariff Rate", "Duty %" → "Base Duty Rate", "Load %" → "Origin Load %", "BD License Fee %" → "B&D Royalty %", "Asia Margin %" → "Supplier Margin %", "Inc 24→25 %" → "Price Increase 2024→2025"
- [x] SKUDetail: consolidate all cost components into one "Import Cost Breakdown" card with formula tooltips
- [x] SKUDetail: add HoverCard tooltip to every cost row label (formula + source)
- [x] DealerPricing: rename "Imp Net L1/L2/L3" → "Import Net Tier 1/2/3", "Dom Net" → "Domestic Net", "Imp Kept Mgn" → "Import Kept Margin"
- [x] SKUTable: rename fob2027 column headers to plain English

### New Feature Pages/Tabs
- [x] New page: /supply-side — Supply Side Settings with HTS Codes, Freight Config, Customer PNL, Snapshots tabs
- [x] New panel: Freight & Import Config — all freight rate inputs in one place with formula tooltips
- [x] New tab: Customer History — per-customer PNL analysis
- [x] New tab: Snapshots — save/delete supply or buy side data snapshots
- [x] SKUTable: case-pack sanity flag — orange ⚠ CASE? badge when per-unit FOB < $5 and pcs/carton > 4, or case-pack total > $500
- [x] DealerPricing: renamed all abbreviated column headers to plain English (Import Net — Tier 1/2/3, Domestic Net, Domestic List, Domestic Margin, 2027 FOB Status)
- [x] SKUTable: renamed FOB 26 Costing → 2026 FOB Cost, BD License Fee % → B&D Royalty %, Asia Margin % → Supplier Margin %, Inc 24-25% → Price Increase 24→25
- [x] Snapshots: implement restore procedure on backend + wire UI with Restore + Delete buttons per snapshot
- [x] Customer CSV import: paste CSV (Name, Tier, 2025-26 Sales) with live preview, append or replace mode

## Phase 15 — Ian's Confirmed Logic Fixes

- [x] Fix royalty category table: Heat Pumps/Ladders/Ladders & Steps → Cat 4 (4.0%); Robotic Cleaners → 0%; Cat 3 (7.0%) = Brushes, Cover Pumps, Skimmers & Rakes — CONFIRMED already correct in tool
- [x] Add brand gate to royalty formula: royalty = 0 for all non-B&D SKUs regardless of category — CONFIRMED already correct in tool
- [x] Fix unit cubic feet formula: add ÷ pcs_per_carton divisor to freight allocation — CONFIRMED already correct in tool
- [x] Verified 49 tests passing, 0 TypeScript errors — no code changes needed

## Phase 16 — Confirmed Fixes from Dan & Ian

- [x] Backend: 34 unmapped B&D SKUs (Parts & Replacement, Uncategorized) confirmed 0% royalty per Dan — explicit comment in code
- [x] Backend: PNL comparison changed to cost-vs-cost (2027 landed cost vs 2026 avg FOB cost) per Dan
- [x] Backend: BLOCKED state added — SKUs with no cost basis return isBlocked=true, never zero
- [x] Backend: Section 122 toggle added to freight_config (sec122_enabled key)
- [x] Frontend: "vs 2026 Cost" column added to Buy Side Matrix with tooltip explaining cost-vs-cost logic
- [x] Frontend: BLOCKED badge (red) on SKUs with missing cost in Buy Side Matrix, row dimmed
- [x] Frontend: Section 122 amber toggle card in Freight Config tab with enable/disable button and expiry note
- [x] 49 tests passing, 0 TypeScript errors

## Phase 17 — Market Price Study + Outbound Freight

- [x] DB: `market_prices` table (sku_code, category, sales_2025_26, hist_avg_price_paid, model_landed_cost, model_import_list, model_t1_net, our_street_price, hayward_comp, hayward_price, pentair_comp, pentair_price, study_date)
- [x] Run migration SQL
- [x] Import Ian's 48-SKU market price study CSV into market_prices table
- [x] tRPC: marketPrices.list — paginated, filterable by category and search
- [x] tRPC: marketPrices.getBySku — single SKU competitive reference
- [x] tRPC: marketPrices.getCategories — distinct category list
- [x] tRPC: marketPrices.summary — category-level stats (avg dealer margin, AC vs Hayward/Pentair)
- [x] Supply Side Settings: add "Market Price Study" tab with summary cards, category table, and SKU-level competitive reference table
- [x] 49 tests passing, 0 TypeScript errors
- [x] Freight Config: outbound delivery cost — confirmed from Excel model that current freight_config covers all inbound ocean freight costs. Outbound (warehouse-to-client) is a separate cost-to-serve item not in the 2027 pricing model scope; Chuck to confirm if it should be added as a separate line item

## Phase 18b — Open Items Resolved from Source Data (July 20, 2026)

- [x] HTS tariff rates: all 8 codes populated from Excel Assumptions tab (9506.99.5500, 8421.21.0000, 8413.70.2004, 3921.13.5000, 2827.20/2836.30, 9603.90.8050, 8418.61.0100, 2933.69.6050)
- [x] Drayage corrected: $600 → $660 per Lynden invoice 40726271 (total destination still $1,545)
- [x] Blank HTS codes resolved: all 10 SKUs assigned HTS from product type (3 pumps, 3 filters/vacuums, 4 accessories/poles)
- [x] Carton dims partially resolved: 9 of 10 blank-HTS SKUs + 5 additional parts SKUs updated from Asia price list
- [x] Chemical reclassification flagged: 2827.20/2836.30 (calcium chloride/sodium bicarb) and 2933.69.6050 (cyanuric acid) in DB with Finding #16 notes — broker confirmation still needed
- [x] Sec 301 rate for 9506.99.5500 corrected to 7.5% (sporting goods rate, not 25%)

## Phase 18 — Ian's Register Findings (Priority 1 Critical)

- [x] Fix Section 232 tariff rate: update from 25% to 50% in hts_tariff_rates table (per CBP 6/4/25) — Finding #15
- [x] Fix tariff stacking: Section 122 must NOT stack on 232-covered portion; fix formula so it applies only to non-232 base — Finding #15
- [x] Block pricing for SKUs with blank HTS codes (same BLOCKED behavior as missing cost) — Finding #17
- [x] Add weight-vs-cube freight allocation: use whichever governs (weight-limited cargo) — Finding #10
- [x] Add tariff scenario selector to Pricing Assumptions: Current Law / 2027 Base / Stress — Finding #14
- [x] Hard-stop freight calculation for SKUs with all carton dims = 0 (BLOCKED-freight flag) — Finding #8
- [x] Verify royalty flows through PNL as a deduction for B&D SKUs — Finding #21 (confirmed embedded in pricing denominator per Dan)
- [x] Add MPF min/max cap logic to landed cost engine ($33.58 min / $651.50 max per entry) — Finding #19
- [x] Add configurable price rounding rules to pricing engine — Finding #30
- [x] Verify kept-margin display formula for royalty-bearing SKUs (~0.6 pt overstatement) — Finding #22 (formula correct; royalty in denominator means no overstatement)
- [x] Rename PNL column labels to "Gross Margin at 2027 Landed Cost" per Ian — Finding #26
- [x] 72 tests passing, 0 TypeScript errors

## Phase 19 — SQLite Full Sync (July 20, 2026)

- [x] Sync HTS codes from SQLite (1,605 already correct; 6 new SKUs added with confirmed FOB quotes)
- [x] Sync carton dims from SQLite (1,183 already correct; 9 additional parts SKUs updated)
- [x] Sync 73 customer records from SQLite sales data (tier assigned by sales volume: T1 ≥$10M, T2 ≥$500K, T3 <$500K)
- [x] Sync 4,486 customer+SKU sales rows into customer_sku_sales table (42 skipped — SKUs not in tool)
- [x] Sync historical avg price paid from item_reported_sales_snapshots (2,146 SKUs updated) — fixes Finding #2
- [x] Customer Sales History drill-down dialog added to Customers tab (click Sales History on any customer)
- [x] getCustomerSkuSales + getCustomerSalesSummary tRPC procedures added
- [x] 72 tests passing, 0 TypeScript errors

## Phase 20 — Full UI Redesign (Dan's 6 Principles)

### Navigation restructure
- [x] Rename nav: SKU Catalog / Supply Side / Buy Side / Dealers / Reports
- [x] Move customer PNL from Supply Side → Dealers (Reports page)
- [x] Move Market Price Study → Reports
- [x] Move Margin Alerts → Reports
- [x] Move Version History → Reports
- [x] Move Import/Export → Reports
- [x] Move Model Lookup → Reports
- [x] Fold Channel Pricing into Dealers as sub-tab (Reports for now)
- [x] Move all margin/tier/royalty inputs → Buy Side page
- [x] Move all freight/tariff/HTS inputs → Supply Side page (stripped)

### Supply Side page (inputs only)
- [x] Ocean freight rates, drayage, destination fees, entry fee, import deposit
- [x] Tariff scenario selector
- [x] HTS tariff rates table
- [x] MPF config
- [x] Hover tooltips on every field
- [x] Remove all customer PNL / market study content

### Buy Side page (inputs only)
- [x] Tier definitions table (T1/T2/T3 with thresholds)
- [x] Dealer tier assignments (editable)
- [x] Margin rules table (global → category → vendor → SKU)
- [x] B&D royalty rules table
- [x] Hover tooltips on every field

### Dealers page
- [x] Dealer list with tier filter, search, total sales
- [x] Dealer detail: purchase history tab (SKU, brand, supplier, qty, avg price, total sales, by year)
- [x] Dealer detail: Build 2027 Price List tab (filter by brand/category/SKU)
- [x] Linear output: SKU | Description | Landed Cost | Import List | Tier Discount | Net Price | Override
- [x] Override specific lines, export CSV
- [ ] Channel pricing sub-tab (online/wholesale matrix) — in Reports for now
- [ ] Hover tooltips on all Dealers output columns

### SKU Catalog page
- [x] SQL-only data, remove any non-SQL references
- [x] Linear column grouping: SKU Info | Cost Data | Pricing | Status
- [x] Hover tooltip on every column header (plain English)
- [x] Clean column headers (no unexplained abbreviations)

### Reports page
- [x] Sub-tabs: Market Price Study | Margin Alerts | Version History | Import/Export | Model Lookup
- [x] Minimalist layout

### Global
- [x] Every column header has a hover tooltip (SKU Catalog complete; Dealers and Buy Side pending)
- [x] No jargon or unexplained abbreviations
- [x] Run tests and save checkpoint

## Phase 21 — Pre-emptive UX Fixes (Dan feedback prevention)

- [x] Dealers: brand filter shown before SKU list loads (filter bar at top: Brand, Supplier)
- [x] Dealers: Supplier column added to purchase history table
- [x] Dealers: 2026 Avg Price Paid column next to 2027 Proposed Price column (side-by-side comparison view)
- [x] Dealers: export button that produces a clean one-page price sheet CSV for the dealer
- [x] Dealers: show BLOCKED/Placeholder badge on SKUs with missing 2027 cost in price builder
- [x] SKU Catalog: "2027 Active Only" toggle — default ON, hides catalog-only SKUs with no FOB price
- [x] SKU Catalog: rename Var 1/Var 2 to Spec 1/Spec 2 with tooltip explaining what they are
- [x] SKU Catalog: add 2027 FOB Price and 2027 Status columns to the default view
- [x] Column tooltips: SKU Catalog — all 30+ columns now have ColTip tooltips
- [x] Column tooltips: Dealers — Cost Basis, Import List, Tier Discount, Net Price, 2026 Avg Price Paid
- [x] Column tooltips: Buy Side — Import Margin, Domestic Margin, Royalty, Lock Section
- [x] AI Pricing Assistant moved to collapsible panel (toggle button in toolbar)
