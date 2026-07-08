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
