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
- [x] Column groups (SKU Info, Pricing, Costs, Margins)
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
- [x] Vitest: versions.list
- [x] Vitest: import.csv (admin, non-admin)
- [x] Vitest: export.csv
- [x] Vitest: margin calculation logic
- [x] Vitest: auth.logout (from template)
