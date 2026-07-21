/**
 * Dealers — dealer-centric workflow.
 * 1. See all dealers, filter by tier.
 * 2. Click a dealer → see their purchase history.
 * 3. Build a 2027 price list: select SKUs by brand/category, see
 *    Landed Cost | Import List | Tier Discount | Net Price side-by-side.
 * 4. Override specific lines, export to CSV.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ChevronRight, Download, HelpCircle, Loader2, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(val: number | string | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtPct(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help shrink-0 inline ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function tierLabel(tier: number) {
  if (tier === 1) return "Level 1";
  if (tier === 2) return "Level 2";
  return "Level 3";
}

function tierColor(tier: number) {
  if (tier === 1) return "default";
  if (tier === 2) return "secondary";
  return "outline";
}

// ─── Dealer List ──────────────────────────────────────────────────────────────

function DealerList({ onSelect }: { onSelect: (id: number, name: string, tier: number) => void }) {
  const { data: customers, isLoading, refetch } = trpc.dealerPricing.getCustomers.useQuery();
  const upsert = trpc.dealerPricing.upsertCustomer.useMutation({ onSuccess: () => refetch() });

  const [tierFilter, setTierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id?: number; name: string; tier: number; notes: string } | null>(null);

  const filtered = (customers ?? []).filter((c) => {
    const matchesTier = tierFilter === "all" || String(c.tier) === tierFilter;
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchesTier && matchesSearch;
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading dealers…
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Dealers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a dealer to view their purchase history or build a 2027 price list.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ name: "", tier: 3, notes: "" })}>
          + Add Dealer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search dealers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="All tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="1">Level 1 only</SelectItem>
            <SelectItem value="2">Level 2 only</SelectItem>
            <SelectItem value="3">Level 3 only</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center">{filtered.length} dealers</span>
      </div>

      {/* Dealer table */}
      <div className="rounded-lg border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                Dealer Name
                <InfoTip text="The dealer's company name as it appears in QuickBooks." />
              </TableHead>
              <TableHead>
                Tier
                <InfoTip text="Pricing tier. Level 1 = highest volume / best discount. Level 2 = mid. Level 3 = standard. Tier determines the discount off list price." />
              </TableHead>
              <TableHead className="text-right">
                2025–26 Sales
                <InfoTip text="Total dollar sales to this dealer in the 2025–26 period, from the QuickBooks export." />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  No dealers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => onSelect(c.id, c.name, c.tier)}
                >
                  <TableCell className="font-medium text-sm">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={tierColor(c.tier) as "default" | "secondary" | "outline"} className="text-xs">
                      {tierLabel(c.tier)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {c.sales2025_26 ? fmt$(parseFloat(c.sales2025_26), 0) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.active
                      ? <Badge variant="outline" className="text-xs text-green-600">Active</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={(e) => { e.stopPropagation(); setEditing({ id: c.id, name: c.name, tier: c.tier, notes: c.notes ?? "" }); }}
                      >
                        Edit
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Dealer" : "Add Dealer"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Dealer Name</Label>
                <Input className="mt-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Tier</Label>
                <Select value={String(editing.tier)} onValueChange={(v) => setEditing({ ...editing, tier: parseInt(v) })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 — Top tier (highest discount)</SelectItem>
                    <SelectItem value="2">Level 2 — Mid tier</SelectItem>
                    <SelectItem value="3">Level 3 — Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Input className="mt-1" value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={() => {
                  upsert.mutate({ id: editing.id, name: editing.name, tier: editing.tier, notes: editing.notes || null });
                  setEditing(null);
                }}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Dealer Detail ────────────────────────────────────────────────────────────

type DealerView = "history" | "comparison" | "pricing";

function DealerDetail({ dealerId, dealerName, dealerTier, onBack }: {
  dealerId: number;
  dealerName: string;
  dealerTier: number;
  onBack: () => void;
}) {
  const [view, setView] = useState<DealerView>("history");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> All Dealers
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-bold text-base">{dealerName}</span>
          <Badge variant={tierColor(dealerTier) as "default" | "secondary" | "outline"} className="text-xs">
            {tierLabel(dealerTier)}
          </Badge>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 border-b pb-0">
        {[
          { key: "history" as DealerView, label: "Purchase History" },
          { key: "comparison" as DealerView, label: "2026 vs 2027" },
          { key: "pricing" as DealerView, label: "2027 Price List" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              view === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "history" && <PurchaseHistoryView dealerId={dealerId} dealerName={dealerName} />}
      {view === "comparison" && <ComparisonView dealerId={dealerId} dealerName={dealerName} dealerTier={dealerTier} />}
      {view === "pricing" && <PriceListBuilder dealerId={dealerId} dealerName={dealerName} dealerTier={dealerTier} />}
    </div>
  );
}

// ─── 2026 vs 2027 Comparison ────────────────────────────────────────────────

function ComparisonView({ dealerId, dealerName, dealerTier }: {
  dealerId: number;
  dealerName: string;
  dealerTier: number;
}) {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");

  // 2025–26 purchase history
  const { data: histData, isLoading: histLoading } = trpc.dealerPricing.getCustomerSkuSales.useQuery(
    { customerId: dealerId, search, brand: brandFilter !== "all" ? brandFilter : undefined, limit: 500, offset: 0 },
    { enabled: true }
  );

  // 2027 proposed pricing for the same dealer
  const { data: pricingData, isLoading: pricingLoading } = trpc.dealerPricing.getBuySideMatrix.useQuery({
    page: 1,
    pageSize: 500,
    search: search || undefined,
    brand: brandFilter !== "all" ? brandFilter : undefined,
    customerId: dealerId,
  });

  const allBrands = Array.from(new Set(
    (histData?.rows ?? []).map((r) => r.supplier).filter((s): s is string => !!s)
  )).sort();

  // Build a pricing lookup map: skuCode → pricing row
  const pricingMap = new Map((pricingData?.rows ?? []).map((r) => [r.sku, r]));

  // Only show SKUs that appear in history (dealer actually bought them)
  const mergedSkus = (histData?.rows ?? []).map((h) => ({
    skuCode: h.skuCode,
    description: h.description,
    supplier: h.supplier,
    productGroup: h.productGroup,
    totalQty: h.totalQty,
    totalSalesAmt: h.totalSalesAmt,
    avgRealizedPrice: h.avgRealizedPrice,
    pricing: pricingMap.get(h.skuCode) ?? null,
  }));

  const isLoading = histLoading || pricingLoading;

  function exportCsv() {
    const header = "SKU,Description,Brand/Supplier,Category,2025-26 Qty,2025-26 Avg Price Paid,2025-26 Total Sales,2027 Landed Cost,2027 Import List,2027 Net Price,FOB Status";
    const rows = mergedSkus.map((r) => {
      const cp = r.pricing?.customerPrices?.[0];
      return [
        r.skuCode,
        `"${(r.description ?? "").replace(/"/g, '""')}"`,
        r.supplier ?? "",
        r.productGroup ?? "",
        r.totalQty ?? 0,
        r.avgRealizedPrice ?? "",
        r.totalSalesAmt ?? "",
        r.pricing?.landedCost ?? "",
        r.pricing?.importList ?? "",
        cp?.importNet ?? "",
        r.pricing?.fob2027Status ?? "",
      ].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dealerName.replace(/\s+/g, "_")}_2026_vs_2027.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground">
          SKUs <strong>{dealerName}</strong> purchased in 2025–26, with their 2027 proposed pricing alongside.
          Only SKUs with purchase history are shown.
        </p>
        <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1" />Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search SKU or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {allBrands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground self-center">{mergedSkus.length} SKUs</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>
                  Brand / Supplier
                  <InfoTip text="The brand or supplier this SKU is sourced from." />
                </TableHead>
                <TableHead className="text-right bg-muted/30">
                  2025–26 Qty
                  <InfoTip text="Total units purchased by this dealer in the 2025–26 period." />
                </TableHead>
                <TableHead className="text-right bg-muted/30">
                  2025–26 Avg Price
                  <InfoTip text="Average price this dealer actually paid per unit in 2025–26 (realized price from QuickBooks)." />
                </TableHead>
                <TableHead className="text-right bg-muted/30">
                  2025–26 Total Sales
                  <InfoTip text="Total dollar amount purchased by this dealer in 2025–26." />
                </TableHead>
                <TableHead className="text-right">
                  2027 Landed Cost
                  <InfoTip text="Total cost to land this SKU in the US warehouse in 2027 (FOB + tariffs + freight). This is our cost, not the price." />
                </TableHead>
                <TableHead className="text-right">
                  2027 Import List
                  <InfoTip text="The 2027 import-track list price. Formula: Landed Cost ÷ (1 − Margin%). Price before dealer discount." />
                </TableHead>
                <TableHead className="text-right">
                  2027 {tierLabel(dealerTier)} Net
                  <InfoTip text={`The 2027 net price for ${dealerName} after their ${tierLabel(dealerTier)} tier discount. This is what you charge them.`} />
                </TableHead>
                <TableHead>
                  FOB Status
                  <InfoTip text="Whether the 2027 factory price is confirmed, a placeholder estimate, or missing." />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergedSkus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                    No purchase history found
                  </TableCell>
                </TableRow>
              ) : (
                mergedSkus.map((r) => {
                  const cp = r.pricing?.customerPrices?.[0];
                  const isBlocked = r.pricing?.isBlocked;
                  const fobStatus = r.pricing?.fob2027Status;
                  return (
                    <TableRow key={r.skuCode}>
                      <TableCell className="font-mono text-xs">{r.skuCode}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{r.description ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.supplier ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm bg-muted/20">{r.totalQty?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm font-mono bg-muted/20">{fmt$(r.avgRealizedPrice)}</TableCell>
                      <TableCell className="text-right text-sm font-mono bg-muted/20">{fmt$(r.totalSalesAmt, 0)}</TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {isBlocked ? <span className="text-muted-foreground">—</span> : fmt$(r.pricing?.landedCost)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {isBlocked ? <span className="text-muted-foreground">—</span> : fmt$(r.pricing?.importList)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {isBlocked ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">BLOCKED</Badge>
                        ) : cp?.importNet != null ? (
                          fmt$(cp.importNet)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {fobStatus === "confirmed" ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600">Confirmed</Badge>
                        ) : fobStatus === "placeholder" ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600">Placeholder</Badge>
                        ) : r.pricing == null ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">No 2027 data</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Missing</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Purchase History ─────────────────────────────────────────────────────────

function PurchaseHistoryView({ dealerId, dealerName }: { dealerId: number; dealerName: string }) {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");

  const { data: summary } = trpc.dealerPricing.getCustomerSalesSummary.useQuery({ customerId: dealerId });
  // Load all rows once (no brand filter) to build the brand dropdown
  const { data: allData } = trpc.dealerPricing.getCustomerSkuSales.useQuery(
    { customerId: dealerId, limit: 500, offset: 0 },
    { enabled: true }
  );
  const allBrands = Array.from(new Set((allData?.rows ?? []).map((r) => r.supplier).filter((s): s is string => !!s))).sort();

  const { data, isLoading } = trpc.dealerPricing.getCustomerSkuSales.useQuery(
    { customerId: dealerId, search, brand: brandFilter !== "all" ? brandFilter : undefined, limit: 300, offset: 0 },
    { enabled: true }
  );

  function exportCsv() {
    if (!data?.rows) return;
    const header = "SKU,Description,Category,Qty,Total Sales,Avg Price Paid";
    const rows = data.rows.map((r) =>
      [r.skuCode, `"${(r.description ?? "").replace(/"/g, '""')}"`, r.productGroup ?? "", r.totalQty ?? 0, r.totalSalesAmt ?? 0, r.avgRealizedPrice ?? 0].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dealerName.replace(/\s+/g, "_")}_purchase_history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{Number(summary.totalSkus).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">SKUs Purchased</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{fmt$(summary.totalSales, 0)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Sales (2025–26)</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{fmt$(summary.avgRealizedPrice)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Avg Realized Price</div>
          </div>
        </div>
      )}

      {/* Search + filters + export */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs w-52"
            placeholder="Search SKU or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />
        </div>
        <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v)}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands / Suppliers</SelectItem>
            {allBrands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSearch(searchInput)}>Search</Button>
        {(search || brandFilter !== "all") && <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSearch(""); setSearchInput(""); setBrandFilter("all"); }}>Clear</Button>}
        <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1" />Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground text-sm justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading purchase history…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  SKU
                  <InfoTip text="The product's unique SKU code." />
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead>
                  Brand / Supplier
                  <InfoTip text="The brand or supplier this SKU is sourced from (e.g. Splash, Darlly, JT, PoolMax)." />
                </TableHead>
                <TableHead>
                  Category
                  <InfoTip text="Product group / category from the item master." />
                </TableHead>
                <TableHead className="text-right">
                  Qty Ordered
                  <InfoTip text="Total units ordered by this dealer in 2025–26." />
                </TableHead>
                <TableHead className="text-right">
                  Total Sales
                  <InfoTip text="Total dollar amount invoiced to this dealer in 2025–26." />
                </TableHead>
                <TableHead className="text-right">
                  Avg Price Paid
                  <InfoTip text="Total Sales ÷ Qty Ordered. This is the realized average price, not the list price." />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    No purchase history found
                  </TableCell>
                </TableRow>
              ) : (
                (data?.rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.skuCode}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">{r.description ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.supplier ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.productGroup ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{Number(r.totalQty ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">{fmt$(r.totalSalesAmt, 0)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt$(r.avgRealizedPrice)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
      {data && (
        <p className="text-xs text-muted-foreground">
          Showing {data.rows.length} of {data.total} SKUs · Source: QuickBooks export (Chuck SQL Transfer 2026-07-17)
        </p>
      )}
    </div>
  );
}

// ─── 2027 Price List Builder ──────────────────────────────────────────────────

function PriceListBuilder({ dealerId, dealerName, dealerTier }: {
  dealerId: number;
  dealerName: string;
  dealerTier: number;
}) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = trpc.dealerPricing.getBuySideMatrix.useQuery({
    page,
    pageSize: 50,
    search: search || undefined,
    brand: brandFilter !== "all" ? brandFilter : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    fob2027StatusFilter: statusFilter !== "all" ? statusFilter : undefined,
    customerId: dealerId,
  });

  const setOverride = trpc.dealerPricing.setOverride.useMutation({
    onSuccess: () => {
      utils.dealerPricing.getBuySideMatrix.invalidate();
      toast.success("Price override saved");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const [editingOverride, setEditingOverride] = useState<{
    skuId: number; sku: string; description: string | null;
    importList: number | null; domesticList: number | null;
    importNet: number | null; domesticNet: number | null;
    importNetOverride: string; domesticNetOverride: string;
    importListOverride: string; domesticListOverride: string;
  } | null>(null);

  function exportCsv() {
    if (!data?.rows) return;
    const header = "SKU,Description,Category,Supplier,FOB Status,Landed Cost,Import List,Domestic List,Dealer Net (Import),Dealer Net (Domestic),Gross Margin at 2027 Landed Cost (Import)";
    const rows = data.rows.map((r) => {
      const cp = r.customerPrices?.[0];
      return [
        r.sku,
        `"${(r.description ?? "").replace(/"/g, '""')}"`,
        r.productGroup ?? "",
        r.supplier ?? "",
        r.fob2027Status ?? "",
        r.landedCost ?? "",
        r.importList ?? "",
        r.domesticList ?? "",
        cp?.importNet ?? "",
        cp?.domesticNet ?? "",
        cp?.keptMarginImport ?? "",
      ].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dealerName.replace(/\s+/g, "_")}_2027_price_list.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const brands = Array.from(new Set((data?.rows ?? []).map((r) => r.supplier).filter(Boolean)));
  const categories = Array.from(new Set((data?.rows ?? []).map((r) => r.productGroup).filter(Boolean)));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            2027 pricing for <strong>{dealerName}</strong> ({tierLabel(dealerTier)}).
            Landed Cost + margin rules from Buy Side → Import List → {tierLabel(dealerTier)} discount → Net Price.
            Click any row's net price to override it for this dealer.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1" />Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs w-52"
            placeholder="Search SKU or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
          />
        </div>
        <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands / Suppliers</SelectItem>
            {brands.map((b) => <SelectItem key={b!} value={b!}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All FOB Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="placeholder">Placeholder</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
          </SelectContent>
        </Select>
        {(search || brandFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all") && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSearch(""); setSearchInput(""); setBrandFilter("all"); setCategoryFilter("all"); setStatusFilter("all"); setPage(1); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Price table */}
      <div className="rounded-lg border overflow-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground text-sm justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading 2027 prices…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">
                  SKU
                  <InfoTip text="The product's unique SKU code." />
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead>
                  Brand / Supplier
                  <InfoTip text="The brand or supplier this SKU is sourced from." />
                </TableHead>
                <TableHead>
                  FOB Status
                  <InfoTip text="Whether we have a confirmed 2027 factory price (FOB) for this SKU. Confirmed = actual quote. Placeholder = estimated. Missing = no cost data, pricing is blocked." />
                </TableHead>
                <TableHead className="text-right">
                  Landed Cost
                  <InfoTip text="Total cost to get this product into the US warehouse. Formula: FOB + (FOB × Tariff%) + Ocean Freight + Drayage + Destination Fees + Entry Fee + Import Deposit." />
                </TableHead>
                <TableHead className="text-right">
                  Import List Price
                  <InfoTip text="The 2027 list price for the import track. Formula: Landed Cost ÷ (1 − Margin%). This is the price before any dealer discount." />
                </TableHead>
                <TableHead className="text-right">
                  {tierLabel(dealerTier)} Net Price
                  <InfoTip text={`The net price for ${dealerName} after applying their ${tierLabel(dealerTier)} discount off the import list price. Click to override for this dealer.`} />
                </TableHead>
                <TableHead className="text-right">
                  Gross Margin
                  <InfoTip text="Gross margin at 2027 landed cost. Formula: (Net Price − Landed Cost) ÷ Net Price. Represents what we keep after covering the cost of goods." />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                    No SKUs found
                  </TableCell>
                </TableRow>
              ) : (
                (data?.rows ?? []).map((r) => {
                  const cp = r.customerPrices?.[0];
                  const isBlocked = r.isBlocked;
                  const hasOverride = cp?.hasOverride;
                  return (
                    <TableRow key={r.skuId} className={isBlocked ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate">{r.description ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.supplier ?? "—"}</TableCell>
                      <TableCell>
                        {isBlocked ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">BLOCKED</Badge>
                        ) : r.fob2027Status === "confirmed" ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600">Confirmed</Badge>
                        ) : r.fob2027Status === "placeholder" ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600">Placeholder</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Missing</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {isBlocked ? "—" : fmt$(r.landedCost)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {isBlocked ? "—" : fmt$(r.importList)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isBlocked ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <button
                            className={`text-sm font-mono hover:underline cursor-pointer ${hasOverride ? "text-amber-600 font-semibold" : ""}`}
                            title={hasOverride ? "Override active — click to edit" : "Click to override this price for this dealer"}
                            onClick={() => setEditingOverride({
                              skuId: r.skuId,
                              sku: r.sku,
                              description: r.description,
                              importList: r.importList,
                              domesticList: r.domesticList,
                              importNet: cp?.importNet ?? null,
                              domesticNet: cp?.domesticNet ?? null,
                              importNetOverride: cp?.hasOverride && cp.importNet ? String(cp.importNet) : "",
                              domesticNetOverride: cp?.hasOverride && cp.domesticNet ? String(cp.domesticNet) : "",
                              importListOverride: "",
                              domesticListOverride: "",
                            })}
                          >
                            {fmt$(cp?.importNet)}
                            {hasOverride && <span className="text-[10px] ml-1 text-amber-500">✎</span>}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {isBlocked || cp?.keptMarginImport == null
                          ? "—"
                          : <span className={Number(cp.keptMarginImport) < 0.15 ? "text-red-500" : "text-green-600"}>
                              {fmtPct(cp.keptMarginImport)}
                            </span>}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 50 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} of {data.total} SKUs</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page * 50 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Override dialog */}
      <Dialog open={!!editingOverride} onOpenChange={(o) => !o && setEditingOverride(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Override Price for {dealerName}
            </DialogTitle>
          </DialogHeader>
          {editingOverride && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                <strong>{editingOverride.sku}</strong> — {editingOverride.description}
                <br />
                Import List: {fmt$(editingOverride.importList)} · Calculated Net: {fmt$(editingOverride.importNet)}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Override Net Price (Import Track)</Label>
                <Input
                  className="h-7 text-xs font-mono"
                  type="number"
                  step="0.01"
                  value={editingOverride.importNetOverride}
                  onChange={(e) => setEditingOverride({ ...editingOverride, importNetOverride: e.target.value })}
                  placeholder={`Calculated: ${fmt$(editingOverride.importNet)}`}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Override Net Price (Domestic Track)</Label>
                <Input
                  className="h-7 text-xs font-mono"
                  type="number"
                  step="0.01"
                  value={editingOverride.domesticNetOverride}
                  onChange={(e) => setEditingOverride({ ...editingOverride, domesticNetOverride: e.target.value })}
                  placeholder={`Calculated: ${fmt$(editingOverride.domesticNet)}`}
                />
              </div>
              <p className="text-xs text-muted-foreground">Leave blank to use the calculated price. Overrides are shown in amber and marked with ✎.</p>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingOverride(null)}>Cancel</Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => {
                    setOverride.mutate({
                      skuId: editingOverride.skuId,
                      customerId: dealerId,
                      clear: true,
                    });
                    setEditingOverride(null);
                  }}
                >
                  Clear Override
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setOverride.mutate({
                      skuId: editingOverride.skuId,
                      customerId: dealerId,
                      importNetOverride: editingOverride.importNetOverride ? parseFloat(editingOverride.importNetOverride) : null,
                      domesticNetOverride: editingOverride.domesticNetOverride ? parseFloat(editingOverride.domesticNetOverride) : null,
                      importListOverride: null,
                      domesticListOverride: null,
                    });
                    setEditingOverride(null);
                  }}
                  disabled={setOverride.isPending}
                >
                  {setOverride.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Override"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dealers() {
  const [selectedDealer, setSelectedDealer] = useState<{ id: number; name: string; tier: number } | null>(null);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {selectedDealer ? (
        <DealerDetail
          dealerId={selectedDealer.id}
          dealerName={selectedDealer.name}
          dealerTier={selectedDealer.tier}
          onBack={() => setSelectedDealer(null)}
        />
      ) : (
        <DealerList onSelect={(id, name, tier) => setSelectedDealer({ id, name, tier })} />
      )}
    </div>
  );
}
