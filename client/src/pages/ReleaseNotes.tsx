/**
 * Release Notes — Dan's hit list.
 * Every version shows:
 *   ✅ What's New (added or changed)
 *   🧪 What to Test (specific actions Dan should try)
 *   🗑 Removed / Moved (anything that disappeared or relocated)
 */
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { CheckCircle2, FlaskConical, Trash2, ChevronDown, ChevronRight, Megaphone } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReleaseEntry {
  version: string;
  date: string;
  summary: string;
  isLatest?: boolean;
  added: string[];
  test: string[];
  removed: string[];
}

// ─── Version data ─────────────────────────────────────────────────────────────

const RELEASES: ReleaseEntry[] = [
  {
    version: "v23",
    date: "Jul 22, 2026",
    summary: "Ruben AI assistant + full mobile pass",
    isLatest: true,
    added: [
      "AI assistant renamed to Ruben — large blue avatar button in the bottom-right corner of every page",
      "Ruben greets you with 'Hi, I'm Ruben!' on first open and knows your live pricing data",
      "On mobile, Ruben opens as a full-screen chat panel so the close button is always reachable",
      "On desktop, Ruben stays as a 390px floating card with a gradient blue header",
      "All filter bars on SKU Catalog, Dealers, Buy Side, and Supply Side are now full-width on mobile",
      "Stats cards on the Dealers purchase history view are compact and readable on small screens",
      "Buy Side global margins and locks grids stack to single column on mobile",
    ],
    test: [
      "Open the app on your phone — tap the blue 'R' button in the bottom-right corner",
      "Ruben's panel should open full-screen. Tap the X in the top-right to close it",
      "Ask Ruben: 'What is UAG's tier level?' — it should answer from live data",
      "Ask Ruben: 'How is the landed cost calculated?' — it should explain the formula",
      "On mobile, go to Dealers → pick a dealer → check that the filter dropdowns are full-width and usable",
      "On mobile, go to SKU Catalog → check that the 4 filter dropdowns stack and are tappable",
    ],
    removed: [
      "The old unnamed bot icon in the bottom-right — replaced by Ruben's avatar",
      "The 'Context: page-name' badge at the bottom of the chat panel (now shown in the header)",
    ],
  },
  {
    version: "v22",
    date: "Jul 21, 2026",
    summary: "Global AI assistant (Ruben, pre-rename)",
    added: [
      "AI assistant available on every page via the floating bot button (bottom-right corner)",
      "Conversational — maintains message history for the session",
      "Context-aware — AI knows which page you're on and loads relevant data automatically",
      "Actionable — AI can propose changes (margin rules, tier discounts, freight config) with a one-click 'Apply' button",
      "AI has full knowledge of the app: formulas, field definitions, how every page works",
    ],
    test: [
      "Click the bot icon (bottom-right) on any page to open the chat",
      "Ask: 'Why is BDXBT53 showing BLOCKED?' — should explain the missing FOB cost",
      "Ask: 'Set the import margin to 32%' — should show an Apply button; click it and verify Buy Side updates",
      "Navigate to a different page — the chat history should persist",
    ],
    removed: [],
  },
  {
    version: "v21",
    date: "Jul 20, 2026",
    summary: "2026 vs 2027 comparison tab + column tooltips",
    added: [
      "Dealers → each dealer now has a '2026 vs 2027' tab between Purchase History and 2027 Price List",
      "Comparison tab shows every SKU that dealer bought in 2025–26 with their 2027 proposed price side-by-side",
      "Columns: SKU, Description, Brand, 2025–26 Qty, 2025–26 Avg Price Paid, 2025–26 Total Sales, 2027 Landed Cost, 2027 Import List, 2027 Tier Net Price, FOB Status badge",
      "Comparison tab has brand filter, SKU search, and Export CSV button",
      "SKU Catalog: '2027 Active Only' toggle (default ON) — hides discontinued and done SKUs",
      "SKU Catalog: Spec 1 / Spec 2 column headers (previously Var 1 / Var 2)",
      "SKU Catalog: 2027 FOB Price and FOB Status columns added",
      "Hover tooltips on all 30+ SKU Catalog columns explaining what each field means",
      "Dealers 2027 Price List: BLOCKED / Placeholder / Confirmed badges on each SKU row",
      "Buy Side: AI Pricing Assistant moved to a collapsible toggle (cleaner default view)",
    ],
    test: [
      "Dealers → UAG → click '2026 vs 2027' tab",
      "Filter by Brand = B&D — should show only B&D products UAG bought, with 2027 prices alongside",
      "Click Export CSV — should download a file with both 2026 and 2027 columns",
      "SKU Catalog → hover over any column header — a tooltip should appear explaining the field",
      "SKU Catalog → toggle '2027 Active Only' off — discontinued SKUs should reappear",
    ],
    removed: [
      "Var 1 / Var 2 column labels — renamed to Spec 1 / Spec 2 everywhere",
    ],
  },
  {
    version: "v20",
    date: "Jul 18, 2026",
    summary: "Dealer purchase history brand filter + supplier column",
    added: [
      "Dealers → Purchase History: Brand filter dropdown to narrow by supplier/brand",
      "Dealers → Purchase History: Supplier column added to the table",
      "Dealers → Purchase History: Export CSV includes supplier column",
    ],
    test: [
      "Dealers → pick any dealer → Purchase History tab",
      "Use the Brand dropdown to filter to 'B&D' — table should narrow to B&D products only",
      "Export CSV and verify the Supplier column is present",
    ],
    removed: [],
  },
  {
    version: "v19",
    date: "Jul 15, 2026",
    summary: "Supply Side tariff engine + landed cost calculator",
    added: [
      "Supply Side page: full tariff rate table (HTS codes, Base Duty, Section 301, 232, 122)",
      "Supply Side: Freight Config tab — set ocean freight $/CBM, air freight $/kg, customs clearance, ISF fee, drayage",
      "Supply Side: Landed Cost calculator — enter FOB price + HTS code → see full cost breakdown",
      "Supply Side: Tariff Scenario toggle (Current Law / 2027 Base / Stress) affects all landed cost calculations",
      "Buy Side: pricing formula now uses live landed cost from Supply Side engine",
    ],
    test: [
      "Supply Side → Freight Config tab → change Ocean Freight rate → go to Dealers → verify landed costs updated",
      "Supply Side → Tariff Scenario → switch to '2027 Base' → check that Section 122 drops to 0% in the calculator",
      "Supply Side → Landed Cost tab → enter FOB $100, HTS 9506.99 → verify the breakdown adds up correctly",
    ],
    removed: [],
  },
  {
    version: "v18",
    date: "Jul 12, 2026",
    summary: "Buy Side pricing engine + dealer price list builder",
    added: [
      "Buy Side page: set global import margin % and domestic margin %",
      "Buy Side: Tier Discounts — set Level 1/2/3 discount off list price",
      "Buy Side: Margin Overrides — override margin at category, vendor, or SKU level",
      "Buy Side: Pricing Configuration — Cost Basis (Landed vs Factory) and Price Rounding",
      "Dealers → 2027 Price List tab: shows Import List, Tier Net Price, Landed Cost for every SKU",
      "Dealers: click any net price to override it for that specific dealer (shown in amber)",
      "Dealers: Export CSV price sheet per dealer",
    ],
    test: [
      "Buy Side → set Import Margin to 30% → go to Dealers → UAG → 2027 Price List → verify prices recalculated",
      "Buy Side → Tier Discounts → click Level 1 → change to 20% → verify UAG (Level 1) prices update",
      "Dealers → UAG → 2027 Price List → click a net price → enter override → verify it shows in amber",
      "Dealers → UAG → 2027 Price List → Export CSV → open file and verify columns",
    ],
    removed: [],
  },
  {
    version: "v17",
    date: "Jul 8, 2026",
    summary: "Dealers page + customer management",
    added: [
      "New Dealers page in sidebar — lists all 57 dealers with tier, 2025–26 sales, and status",
      "Click any dealer to open their detail view",
      "Dealer detail: Purchase History tab — all SKUs that dealer bought in 2025–26 from QuickBooks",
      "Add / Edit dealer dialog (name, tier, notes)",
      "Tier filter on dealer list (All / Level 1 / Level 2 / Level 3)",
    ],
    test: [
      "Dealers → search for 'UAG' → click to open",
      "Purchase History tab should show all SKUs UAG bought with qty, avg price, and total",
      "Click + Add Dealer → add a test dealer → verify it appears in the list",
      "Edit a dealer's tier → verify the badge updates",
    ],
    removed: [
      "Customer management was previously inside the Buy Side page — it is now its own Dealers page",
    ],
  },
  {
    version: "v16",
    date: "Jul 5, 2026",
    summary: "Section locks + password protection",
    added: [
      "Buy Side → Locks tab: password-protect the Supply Side and Buy Side independently",
      "When a section is locked, all edit buttons are disabled until the correct password is entered",
      "Lock/Unlock icons in the sidebar nav indicate current lock state",
    ],
    test: [
      "Buy Side → Locks tab → lock Supply Side with a password",
      "Go to Supply Side → try to edit a freight rate → should be blocked",
      "Return to Locks → unlock with the password → Supply Side edits should work again",
    ],
    removed: [],
  },
  {
    version: "v15",
    date: "Jul 2, 2026",
    summary: "Ian's verified DB import — 2027 FOB prices",
    added: [
      "2,152 SKUs updated with verified carton dims, HTS codes, source status, and supplier from Ian's database",
      "24 confirmed 2027 FOB quote prices imported (shown in green in SKU Catalog)",
      "Remaining SKUs marked Placeholder (yellow) or Missing (red) based on data availability",
      "SKU Catalog: new '2027 FOB Price' column and 'FOB Status' column",
      "SKU Catalog: 'Needs 2027 FOB' filter option in Source Status dropdown",
    ],
    test: [
      "SKU Catalog → filter Source Status = 'Needs 2027 FOB' → should show SKUs with missing quotes",
      "Find BDXBT53 → FOB Status should show 'Missing' in red",
      "Find BDXBT80 → FOB Status should show 'Confirmed' in green with a price",
    ],
    removed: [],
  },
  {
    version: "v14",
    date: "Jun 28, 2026",
    summary: "Reports page + margin alert dashboard",
    added: [
      "New Reports page in sidebar",
      "Margin Alerts tab: shows all SKUs where channel price is below floor or margin is below target",
      "Margin Alerts: filter by channel, adjust threshold slider, sort by severity",
      "Margin Alerts: summary stats (total alerts, by channel, by product group)",
      "SKU Detail page (/sku/:id): full read-only view of all costing, pricing, sourcing, carton details, and channel prices",
      "Click any SKU code in the table to open its detail page",
    ],
    test: [
      "Reports → Margin Alerts → set threshold to 25% → check which SKUs appear",
      "Click any SKU code in the SKU Catalog → should open the detail page",
      "SKU detail page → scroll through all sections: Pricing, Costs, Sourcing, Carton Details, Channel Prices",
    ],
    removed: [],
  },
  {
    version: "v13",
    date: "Jun 22, 2026",
    summary: "Channel pricing matrix + bulk price import",
    added: [
      "Channel Pricing page: online storefronts (poolpartstogo.com, Amazon, Walmart, poolsupplyworld.com) and wholesale partners in a pricing matrix",
      "Click any cell to set price, floor, ceiling, target margin %, competitor price, and notes",
      "Apply Rule button: recalculate all prices for a channel based on target margin",
      "Bulk import channel prices from CSV (SKU, Channel, Price)",
      "Export price sheet per channel as CSV",
    ],
    test: [
      "Channel Pricing → Online tab → click a cell for any SKU → set a price → verify margin % updates",
      "Channel Pricing → Apply Rule → set target margin 30% for Amazon → verify all Amazon prices recalculate",
      "Import / Export → Import Channel Prices → download template → fill in 3 rows → upload → verify prices updated",
    ],
    removed: [],
  },
  {
    version: "v12",
    date: "Jun 15, 2026",
    summary: "Asia SKU merge + carton details",
    added: [
      "SKU Catalog: new Sourcing Info column group (Supplier, HTS Code, Packing Type, Carton Dims)",
      "Carton Details button (box icon) on each SKU row — opens a modal with the full carton breakdown",
      "Supplier and Source Status filter dropdowns in SKU Catalog",
      "Edit SKU dialog updated with all new sourcing fields",
    ],
    test: [
      "SKU Catalog → click the box icon on any row → Carton Details modal should open",
      "SKU Catalog → filter Supplier = 'B&D' → only B&D SKUs should show",
      "Edit a SKU → fill in HTS Code and Carton dims → save → verify they appear in the table",
    ],
    removed: [],
  },
  {
    version: "v11 and earlier",
    date: "Before Jun 2026",
    summary: "Foundation: SKU Catalog, AI pricing, version history, import/export, model lookup",
    added: [
      "SKU Catalog with all pricing columns (SRP, MAP, FOB, Landed Cost, Margins)",
      "AI Pricing Assistant on SKU Catalog — bulk edit prices with natural language",
      "Version History page — full audit trail of every change with before/after diff",
      "Import / Export page — CSV import and export for all SKU data",
      "Model Lookup page — instant search by SKU or description",
      "6,778 SKUs imported from the 2026 Official spreadsheet",
    ],
    test: [
      "SKU Catalog → AI → type 'Increase all Heat Pump SRP 2024 by 5%' → Preview → Apply",
      "Version History → find the change you just made → expand the diff",
      "Import / Export → Export → download CSV → verify all columns present",
    ],
    removed: [],
  },
];

// ─── Version card ─────────────────────────────────────────────────────────────

function VersionCard({ entry, defaultOpen }: { entry: ReleaseEntry; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className={`rounded-xl border overflow-hidden ${entry.isLatest ? "border-primary/40 shadow-sm" : ""}`}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-primary">{entry.version}</span>
          {entry.isLatest && (
            <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">Latest</Badge>
          )}
          <span className="text-sm font-medium">{entry.summary}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:block">{entry.date}</span>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 py-4 space-y-4 border-t">
          <p className="text-xs text-muted-foreground">{entry.date}</p>

          {/* What's New */}
          {entry.added.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">What's New</span>
              </div>
              <ul className="space-y-1.5">
                {entry.added.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What to Test */}
          {entry.test.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <FlaskConical className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">What to Test</span>
              </div>
              <ol className="space-y-1.5 list-none">
                {entry.test.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-blue-500 font-mono text-xs mt-0.5 shrink-0 w-4">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Removed / Moved */}
          {entry.removed.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-600">Removed / Moved</span>
              </div>
              <ul className="space-y-1.5">
                {entry.removed.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-red-400 mt-0.5 shrink-0">−</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReleaseNotes() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Release Notes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every version — what changed, what to test, and what moved. Latest version is open by default.
          </p>
        </div>
      </div>

      {/* Tip box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-800">
        <strong>Tip:</strong> Start with the <strong>What to Test</strong> checklist for the latest version. If anything looks wrong, ask <strong>Ruben</strong> (the blue button, bottom-right) — he knows every feature.
      </div>

      {/* Version list */}
      <ScrollArea className="h-full">
        <div className="space-y-3 pb-8">
          {RELEASES.map((entry, i) => (
            <VersionCard key={entry.version} entry={entry} defaultOpen={i === 0} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
