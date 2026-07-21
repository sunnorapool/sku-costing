/**
 * Reports — all output-only views:
 * - Market Price Study (competitive reference for top 50 SKUs)
 * - Margin Alerts (SKUs below minimum margin threshold)
 * - Version History (audit trail of changes)
 * - Snapshots (save/restore model state)
 * - Import / Export (CSV upload/download)
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
import { AlertTriangle, Archive, BarChart2, Download, HelpCircle, Loader2, RefreshCw, Search, Upload } from "lucide-react";
import { useRef, useState } from "react";
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

type ReportTab = "market" | "alerts" | "versions" | "snapshots" | "import";

// ─── Market Price Study ───────────────────────────────────────────────────────

function MarketPriceStudyTab() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: categories } = trpc.marketPrices.getCategories.useQuery();
  const { data: summaryData } = trpc.marketPrices.summary.useQuery();
  const summary = summaryData ? {
    totalSkus: summaryData.skuCount,
    avgDealerMargin: summaryData.overallAvgDealerMarginPct,
    avgVsHayward: summaryData.categories.length > 0
      ? summaryData.categories.reduce((s, c) => s + (c.avgAcVsHaywardPct ?? 0), 0) / Math.max(1, summaryData.categories.filter(c => c.avgAcVsHaywardPct != null).length)
      : null,
    avgVsPentair: summaryData.categories.length > 0
      ? summaryData.categories.reduce((s, c) => s + (c.avgAcVsPentairPct ?? 0), 0) / Math.max(1, summaryData.categories.filter(c => c.avgAcVsPentairPct != null).length)
      : null,
  } : null;
  const { data, isLoading } = trpc.marketPrices.list.useQuery({
    page,
    pageSize: 50,
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Market Price Study</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Competitive reference for the top pump/filter/heater SKUs. Source: Ian Allen market study, July 20, 2026.
          <span className="text-amber-600 ml-2">⚠ Avg price paid figures are under review (Finding #2 — 10.68% understatement).</span>
        </p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{summary.totalSkus}</div>
            <div className="text-xs text-muted-foreground mt-0.5">SKUs Studied</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{fmtPct(summary.avgDealerMargin)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Avg Dealer Margin at T1 Net</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className={`text-xl font-bold ${Number(summary.avgVsHayward) > 0 ? "text-red-500" : "text-green-600"}`}>
              {fmtPct(summary.avgVsHayward)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">AC vs Hayward (avg)</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className={`text-xl font-bold ${Number(summary.avgVsPentair) > 0 ? "text-red-500" : "text-green-600"}`}>
              {fmtPct(summary.avgVsPentair)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">AC vs Pentair (avg)</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search SKU or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(categories ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground text-sm justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU <InfoTip text="SKU code from the market study." /></TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">
                  2027 Landed Cost
                  <InfoTip text="Calculated 2027 landed cost from the pricing engine." />
                </TableHead>
                <TableHead className="text-right">
                  T1 Net
                  <InfoTip text="2027 T1 (top tier) net price after applying the import margin rule." />
                </TableHead>
                <TableHead className="text-right">
                  Dealer Margin
                  <InfoTip text="Gross margin at T1 net price. Formula: (T1 Net − Landed Cost) ÷ T1 Net." />
                </TableHead>
                <TableHead className="text-right">
                  AC Street
                  <InfoTip text="Asia Connection's current street (retail) price from the market study." />
                </TableHead>
                <TableHead className="text-right">
                  Hayward Comp
                  <InfoTip text="Hayward's comparable product street price. Negative % = AC is cheaper." />
                </TableHead>
                <TableHead className="text-right">
                  Pentair Comp
                  <InfoTip text="Pentair's comparable product street price. Negative % = AC is cheaper." />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    No SKUs found
                  </TableCell>
                </TableRow>
              ) : (
                (data?.rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.skuCode}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.category ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.category ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmt$(r.modelLandedCost)}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmt$(r.modelT1Net)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.modelT1Net && r.modelLandedCost
                        ? <span className={((Number(r.modelT1Net) - Number(r.modelLandedCost)) / Number(r.modelT1Net)) < 0.15 ? "text-red-500" : "text-green-600"}>
                            {fmtPct((Number(r.modelT1Net) - Number(r.modelLandedCost)) / Number(r.modelT1Net))}
                          </span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmt$(r.ourStreetPrice)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.haywardComp && r.ourStreetPrice
                        ? <span className={Number(r.haywardComp) < 0 ? "text-green-600" : "text-red-500"}>
                            {fmtPct(r.haywardComp)} ({fmt$(r.haywardPrice)})
                          </span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.pentairComp && r.ourStreetPrice
                        ? <span className={Number(r.pentairComp) < 0 ? "text-green-600" : "text-red-500"}>
                            {fmtPct(r.pentairComp)} ({fmt$(r.pentairPrice)})
                          </span>
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
      {data && (
        <p className="text-xs text-muted-foreground">
          {data.rows.length} of {data.total} SKUs · Source: Ian Allen market study, July 20, 2026
        </p>
      )}
    </div>
  );
}

// ─── Margin Alerts ────────────────────────────────────────────────────────────

function MarginAlertsTab() {
  const { data, isLoading, refetch } = trpc.channelPrices.marginAlerts.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">Margin Alerts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            SKUs where the channel price produces a gross margin below the minimum threshold.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
        </Button>
      </div>

      <div className="rounded-lg border overflow-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground text-sm justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading alerts…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">
                  Channel Price
                  <InfoTip text="The current price set for this channel." />
                </TableHead>
                <TableHead className="text-right">
                  Landed Cost
                  <InfoTip text="Total cost to land this product in the US warehouse." />
                </TableHead>
                <TableHead className="text-right">
                  Margin
                  <InfoTip text="(Channel Price − Landed Cost) ÷ Channel Price. Red = below minimum threshold." />
                </TableHead>
                <TableHead className="text-right">Min Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    No margin alerts — all channel prices are above minimum thresholds
                  </TableCell>
                </TableRow>
              ) : (
                (data ?? []).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.skuCode}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.description ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.channelName}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmt$(r.price)}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmt$(r.landedCost)}</TableCell>
                    <TableCell className="text-right text-sm text-red-500 font-semibold">{fmtPct(r.marginPct)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{fmtPct(r.targetMarginPct ?? "0.20")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── Version History ──────────────────────────────────────────────────────────

function VersionHistoryTab() {
  const { data, isLoading } = trpc.versions.list.useQuery({ limit: 100, offset: 0 } as const);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Version History</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audit trail of all changes made to SKUs and pricing in this tool.
        </p>
      </div>
      <div className="rounded-lg border overflow-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground text-sm justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Time</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old Value</TableHead>
                <TableHead>New Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No version history yet
                  </TableCell>
                </TableRow>
              ) : (
                (data?.items ?? []).map((v) => (
                  <TableRow key={v.version.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(v.version.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{String(v.version.skuId ?? "—")}</TableCell>
                    <TableCell className="text-xs">{v.version.changeType ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.version.changeDescription ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.user?.name ?? "System"}</TableCell>
                    <TableCell className="text-xs">{v.version.promptText ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

function SnapshotsTab() {
  const utils = trpc.useUtils();
  const { data: snapshots, isLoading } = trpc.supplySide["snapshots.list"].useQuery();
  const saveMut = trpc.supplySide["snapshots.save"].useMutation({
    onSuccess: () => { utils.supplySide["snapshots.list"].invalidate(); toast.success("Snapshot saved"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const restoreMut = trpc.supplySide["snapshots.restore"].useMutation({
    onSuccess: () => { toast.success("Snapshot restored — reload the page to see changes"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const deleteMut = trpc.supplySide["snapshots.delete"].useMutation({
    onSuccess: () => { utils.supplySide["snapshots.list"].invalidate(); toast.success("Snapshot deleted"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const [newLabel, setNewLabel] = useState("");
  const [confirmRestore, setConfirmRestore] = useState<{ id: number; label: string } | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Snapshots</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Save the current state of all SKUs, freight config, and pricing config as a named snapshot.
          Restore any snapshot to roll back to that state.
        </p>
      </div>

      {/* Save new snapshot */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 max-w-xs">
          <Label className="text-xs">Snapshot Label</Label>
          <Input
            className="mt-1 h-8 text-xs"
            placeholder='e.g. "Prototype — Not Approved 2026-07-21"'
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          disabled={!newLabel.trim() || saveMut.isPending}
          onClick={() => { saveMut.mutate({ label: newLabel.trim(), scope: "supply" }); setNewLabel(""); }}
        >
          {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3.5 w-3.5 mr-1" />}
          Save Snapshot
        </Button>
      </div>

      {/* Snapshot list */}
      <div className="rounded-lg border overflow-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground text-sm justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading snapshots…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Saved At</TableHead>
                <TableHead>SKUs</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(snapshots ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                    No snapshots saved yet
                  </TableCell>
                </TableRow>
              ) : (
                (snapshots ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm font-medium">{s.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.skuCount ?? "—"} SKUs
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setConfirmRestore({ id: s.id, label: s.label })}
                        >
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:text-red-600"
                          onClick={() => deleteMut.mutate({ id: s.id })}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Confirm restore dialog */}
      <Dialog open={!!confirmRestore} onOpenChange={(o) => !o && setConfirmRestore(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Restore Snapshot?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            This will overwrite all current SKU costs, freight config, and pricing config with the values from <strong>"{confirmRestore?.label}"</strong>. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => {
                if (confirmRestore) restoreMut.mutate({ id: confirmRestore.id });
                setConfirmRestore(null);
              }}
            >
              Restore
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Import / Export ──────────────────────────────────────────────────────────

function ImportExportTab() {
  const utils = trpc.useUtils();
  const importSkusMut = trpc.import.csv.useMutation({
    onSuccess: (res) => {
      utils.skus.list.invalidate();
      toast.success(`Imported/updated ${res.created + res.updated} SKUs`);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const importChannelMut = trpc.channelPrices.bulkImportCsv.useMutation({
    onSuccess: (res) => {
      toast.success(`Imported ${res.created + res.updated} channel prices`);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const skuFileRef = useRef<HTMLInputElement>(null);
  const channelFileRef = useRef<HTMLInputElement>(null);

  function readCsv(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function parseCsvToRows(csv: string): Record<string, string>[] {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
      return row;
    });
  }

  async function handleSkuImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await readCsv(file);
    const parsed = parseCsvToRows(csv);
    const rows = parsed.map(r => ({ sku: r.sku ?? r.SKU ?? "", description: r.description, productGroup: r.productGroup, factoryCost: r.factoryCost, landedCost: r.landedCost })).filter(r => r.sku);
    importSkusMut.mutate({ rows } as Parameters<typeof importSkusMut.mutate>[0]);
    e.target.value = "";
  }

  async function handleChannelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await readCsv(file);
    const parsed = parseCsvToRows(csv);
    const rows = parsed.map(r => ({ skuCode: r.sku ?? r.skuCode ?? "", channelName: r.channel ?? r.channelName ?? "", price: r.price ?? "" })).filter(r => r.skuCode && r.channelName && r.price);
    importChannelMut.mutate({ rows });
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Import / Export</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload CSV files to update SKU data or channel prices. Download the current data as CSV.
        </p>
      </div>

      {/* SKU import/export */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">SKU Catalog</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Import a CSV to add or update SKUs. Required columns: sku, description, productGroup, supplier, fob2027Price.
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={skuFileRef} type="file" accept=".csv" className="hidden" onChange={handleSkuImport} />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => skuFileRef.current?.click()}
            disabled={importSkusMut.isPending}
          >
            {importSkusMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            Import SKUs CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => { window.location.href = "/api/export/skus.csv"; }}
          >
            <Download className="h-3.5 w-3.5 mr-1" />Export SKUs CSV
          </Button>
        </div>
      </div>

      {/* Channel prices import/export */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">Channel Prices</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Import a CSV to update channel prices in bulk. Required columns: sku, channel, price.
          </div>
        </div>
        <div className="flex gap-2">
          <input ref={channelFileRef} type="file" accept=".csv" className="hidden" onChange={handleChannelImport} />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => channelFileRef.current?.click()}
            disabled={importChannelMut.isPending}
          >
            {importChannelMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            Import Channel Prices CSV
          </Button>
        </div>
      </div>

      {/* FOB quotes import */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">2027 FOB Quotes (Jon)</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            When Jon provides confirmed 2027 FOB quotes from the factories, import them here.
            Required columns: sku, fob2027Price, fob2027Status (confirmed/placeholder).
            This will automatically unblock any SKUs currently showing as Placeholder.
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => { toast.info("Use the SKU Catalog import — set fob2027Status to 'confirmed' and provide fob2027Price"); }}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />Import FOB Quotes CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
  { key: "market", label: "Market Price Study", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "alerts", label: "Margin Alerts", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { key: "versions", label: "Version History", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { key: "snapshots", label: "Snapshots", icon: <Archive className="h-3.5 w-3.5" /> },
  { key: "import", label: "Import / Export", icon: <Download className="h-3.5 w-3.5" /> },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("market");

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Reports</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Output-only views: competitive analysis, margin health, audit trail, and data management.
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b pb-0">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {activeTab === "market" && <MarketPriceStudyTab />}
      {activeTab === "alerts" && <MarginAlertsTab />}
      {activeTab === "versions" && <VersionHistoryTab />}
      {activeTab === "snapshots" && <SnapshotsTab />}
      {activeTab === "import" && <ImportExportTab />}
    </div>
  );
}
