import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Edit3,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(v: string | null | undefined) {
  if (!v) return null;
  const n = Number(v);
  return isNaN(n) ? null : `$${n.toFixed(2)}`;
}

function fmtPct(v: string | null | undefined) {
  if (!v) return null;
  const n = Number(v);
  return isNaN(n) ? null : `${(n * 100).toFixed(1)}%`;
}

function marginColor(pct: string | null | undefined): string {
  if (!pct) return "text-muted-foreground";
  const n = Number(pct);
  if (n >= 0.35) return "text-emerald-600 dark:text-emerald-400";
  if (n >= 0.25) return "text-yellow-600 dark:text-yellow-400";
  if (n >= 0.15) return "text-orange-500 dark:text-orange-400";
  return "text-red-500 dark:text-red-400";
}

function marginBg(pct: string | null | undefined): string {
  if (!pct) return "";
  const n = Number(pct);
  if (n >= 0.35) return "bg-emerald-50 dark:bg-emerald-950/30";
  if (n >= 0.25) return "bg-yellow-50 dark:bg-yellow-950/30";
  if (n >= 0.15) return "bg-orange-50 dark:bg-orange-950/30";
  return "bg-red-50 dark:bg-red-950/30";
}

// ─── Price Cell Edit Popover ──────────────────────────────────────────────────

interface CellEditProps {
  skuId: number;
  channelId: number;
  channelName: string;
  skuCode: string;
  landedCost: string | null | undefined;
  existing: {
    price?: string | null;
    floorPrice?: string | null;
    ceilingPrice?: string | null;
    targetMarginPct?: string | null;
    competitorPrice?: string | null;
    competitorUrl?: string | null;
    notes?: string | null;
    marginPct?: string | null;
    marginAmt?: string | null;
  } | null;
  onSaved: () => void;
}

function CellEditPopover({ skuId, channelId, channelName, skuCode, landedCost, existing, onSaved }: CellEditProps) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(existing?.price ?? "");
  const [floor, setFloor] = useState(existing?.floorPrice ?? "");
  const [ceiling, setCeiling] = useState(existing?.ceilingPrice ?? "");
  const [targetMargin, setTargetMargin] = useState(
    existing?.targetMarginPct ? (Number(existing.targetMarginPct) * 100).toFixed(1) : ""
  );
  const [compPrice, setCompPrice] = useState(existing?.competitorPrice ?? "");
  const [compUrl, setCompUrl] = useState(existing?.competitorUrl ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  // Reset when existing changes
  useEffect(() => {
    if (open) {
      setPrice(existing?.price ?? "");
      setFloor(existing?.floorPrice ?? "");
      setCeiling(existing?.ceilingPrice ?? "");
      setTargetMargin(existing?.targetMarginPct ? (Number(existing.targetMarginPct) * 100).toFixed(1) : "");
      setCompPrice(existing?.competitorPrice ?? "");
      setCompUrl(existing?.competitorUrl ?? "");
      setNotes(existing?.notes ?? "");
    }
  }, [open]);

  // Live margin preview
  const liveMargin = useMemo(() => {
    const p = Number(price);
    const l = Number(landedCost ?? 0);
    if (p > 0 && l > 0) return ((p - l) / p * 100).toFixed(1);
    return null;
  }, [price, landedCost]);

  // Auto-fill price from target margin
  const applyTargetMargin = () => {
    const m = Number(targetMargin) / 100;
    const l = Number(landedCost ?? 0);
    if (m > 0 && m < 1 && l > 0) {
      setPrice((l / (1 - m)).toFixed(2));
    }
  };

  const upsert = trpc.channelPrices.upsert.useMutation({
    onSuccess: () => {
      toast.success(`Saved ${skuCode} → ${channelName}`);
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = () => {
    upsert.mutate({
      skuId,
      channelId,
      price: price || null,
      floorPrice: floor || null,
      ceilingPrice: ceiling || null,
      targetMarginPct: targetMargin ? String(Number(targetMargin) / 100) : null,
      competitorPrice: compPrice || null,
      competitorUrl: compUrl || null,
      notes: notes || null,
    });
  };

  const hasPrice = !!existing?.price;
  const marginPct = existing?.marginPct;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-full h-full min-h-[52px] px-2 py-1.5 text-left group relative transition-colors hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30 ${marginBg(marginPct)}`}
        >
          {hasPrice ? (
            <div className="space-y-0.5">
              <div className="text-xs font-semibold tabular-nums">{fmtPrice(existing?.price)}</div>
              {marginPct && (
                <div className={`text-[10px] font-medium tabular-nums ${marginColor(marginPct)}`}>
                  {fmtPct(marginPct)} margin
                </div>
              )}
              {existing?.floorPrice && Number(existing.price) < Number(existing.floorPrice) && (
                <AlertTriangle className="h-3 w-3 text-red-500 absolute top-1 right-1" />
              )}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
              — set price
            </div>
          )}
          <Edit3 className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary/60 absolute bottom-1 right-1 transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="bottom">
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold">{skuCode}</p>
              <p className="text-[10px] text-muted-foreground">{channelName}</p>
            </div>
            {landedCost && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Landed Cost</p>
                <p className="text-xs font-semibold">${Number(landedCost).toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Price + live margin */}
          <div className="space-y-1">
            <Label className="text-xs">Selling Price</Label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-sm"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              {liveMargin && (
                <Badge variant="outline" className={`text-[10px] shrink-0 ${marginColor(String(Number(liveMargin) / 100))}`}>
                  {liveMargin}% margin
                </Badge>
              )}
            </div>
          </div>

          {/* Target margin auto-fill */}
          <div className="space-y-1">
            <Label className="text-xs">Target Margin %</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="e.g. 35"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
              />
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs shrink-0" onClick={applyTargetMargin}>
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Apply
              </Button>
            </div>
            {landedCost && targetMargin && (
              <p className="text-[10px] text-muted-foreground">
                Calculated price: ${(Number(landedCost) / (1 - Number(targetMargin) / 100)).toFixed(2)}
              </p>
            )}
          </div>

          <Separator />

          {/* Floor / Ceiling */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Floor Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-7 h-8 text-sm" placeholder="min" value={floor} onChange={(e) => setFloor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ceiling Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-7 h-8 text-sm" placeholder="max" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Competitor */}
          <div className="space-y-1">
            <Label className="text-xs">Competitor Price</Label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7 h-8 text-sm" placeholder="0.00" value={compPrice} onChange={(e) => setCompPrice(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Competitor URL</Label>
            <Input className="h-8 text-sm" placeholder="https://..." value={compUrl} onChange={(e) => setCompUrl(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input className="h-8 text-sm" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <Button className="flex-1 h-8 text-xs" onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button variant="outline" className="h-8 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Apply Rule Dialog ────────────────────────────────────────────────────────

interface ApplyRuleProps {
  channels: { id: number; name: string }[];
  onApplied: () => void;
}

function ApplyRulePanel({ channels: channelList, onApplied }: ApplyRuleProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [targetMargin, setTargetMargin] = useState("35");
  const applyRule = trpc.channelPrices.applyRule.useMutation({
    onSuccess: (res) => {
      toast.success(`Applied rule to ${res.updated} SKUs`);
      onApplied();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <div className="flex items-end gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
      <Settings2 className="h-4 w-4 text-muted-foreground shrink-0 mb-1.5" />
      <div className="space-y-1 flex-1">
        <Label className="text-xs text-muted-foreground">Apply Pricing Rule</Label>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {channelList.map((c) => (
                <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Target margin:</span>
            <Input
              className="h-8 text-xs w-16"
              value={targetMargin}
              onChange={(e) => setTargetMargin(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!selectedChannel || applyRule.isPending}
            onClick={() => {
              if (!selectedChannel) return;
              applyRule.mutate({
                channelId: Number(selectedChannel),
                targetMarginPct: Number(targetMargin) / 100,
              });
            }}
          >
            {applyRule.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <TrendingUp className="h-3.5 w-3.5 mr-1" />}
            Apply to All Active SKUs
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Calculates price = Landed Cost ÷ (1 − margin%) for every active SKU that has a landed cost.
        </p>
      </div>
    </div>
  );
}

// ─── Pricing Matrix ───────────────────────────────────────────────────────────

interface MatrixProps {
  channelType: "online" | "wholesale";
}

function escapeCSV(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function PricingMatrix({ channelType }: MatrixProps) {
  const [search, setSearch] = useState("");
  const [productGroup, setProductGroup] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportingChannelId, setExportingChannelId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const PAGE_SIZE = 50;

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(v); setPage(0); }, 300);
  };

  const productGroupsQuery = trpc.skus.productGroups.useQuery();
  const suppliersQuery = trpc.skus.suppliers.useQuery();

  const matrixQuery = trpc.channelPrices.matrix.useQuery(
    {
      channelType,
      search: debouncedSearch || undefined,
      productGroup: productGroup !== "all" ? productGroup : undefined,
      supplier: supplierFilter !== "all" ? supplierFilter : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
  );

  const { skus: skuRows = [], channels: channelList = [], prices = [], total = 0 } = matrixQuery.data ?? {};

  // Build price lookup: skuId → channelId → price record
  const priceMap = useMemo(() => {
    const map = new Map<number, Map<number, typeof prices[0]>>();
    for (const p of prices) {
      if (!map.has(p.skuId)) map.set(p.skuId, new Map());
      map.get(p.skuId)!.set(p.channelId, p);
    }
    return map;
  }, [prices]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const refresh = () => setRefreshKey(k => k + 1);
  useEffect(() => { matrixQuery.refetch(); }, [refreshKey]);

  const isLoading = matrixQuery.isLoading || matrixQuery.isFetching;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search SKU or description…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setSearch(""); setDebouncedSearch(""); setPage(0); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Select value={productGroup} onValueChange={(v) => { setProductGroup(v); setPage(0); }}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue placeholder="All Product Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Product Groups</SelectItem>
            {(productGroupsQuery.data ?? []).map((g) => (
              <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Suppliers</SelectItem>
            {(suppliersQuery.data ?? []).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{total.toLocaleString()} SKUs</span>
      </div>

      {/* Apply Rule */}
      {/* Export row */}
      {channelList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Export price sheet:</span>
          {channelList.map(ch => (
            <Button
              key={ch.id}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={exportingChannelId === ch.id}
              onClick={async () => {
                setExportingChannelId(ch.id);
                try {
                  const rows = await utils.channelPrices.exportSheet.fetch({
                    channelId: ch.id,
                    productGroup: productGroup !== "all" ? productGroup : undefined,
                  });
                  if (!rows || rows.length === 0) { toast.info(`No priced SKUs for ${ch.name}`); return; }
                  const headers = ["SKU","Description","Product Group","Var1","Var2","Status","Landed Cost","SRP 2024","MAP","Channel Price","Floor Price","Ceiling Price","Target Margin %","Margin %","Margin $","Competitor Price","Notes","Effective Date"];
                  const lines = [headers.join(",")];
                  for (const r of rows) {
                    lines.push([
                      r.sku, r.description, r.productGroup, r.var1, r.var2, r.status,
                      r.landedCost, r.srp2024, r.map, r.channelPrice, r.floorPrice, r.ceilingPrice,
                      r.targetMarginPct ? (Number(r.targetMarginPct)*100).toFixed(1)+'%' : '',
                      r.marginPct ? (Number(r.marginPct)*100).toFixed(1)+'%' : '',
                      r.marginAmt, r.competitorPrice, r.notes,
                      r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '',
                    ].map(escapeCSV).join(","));
                  }
                  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `price-sheet-${ch.name.replace(/[^a-z0-9]/gi,"-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`Exported ${rows.length} SKUs for ${ch.name}`);
                } catch (e: any) {
                  toast.error(`Export failed: ${e.message}`);
                } finally {
                  setExportingChannelId(null);
                }
              }}
            >
              {exportingChannelId === ch.id
                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                : <Download className="h-3 w-3 mr-1" />}
              {ch.name}
            </Button>
          ))}
        </div>
      )}

      <ApplyRulePanel channels={channelList} onApplied={refresh} />

      {/* Legend */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300/50" />≥35%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-100 dark:bg-yellow-950/50 border border-yellow-300/50" />≥25%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-100 dark:bg-orange-950/50 border border-orange-300/50" />≥15%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-100 dark:bg-red-950/50 border border-red-300/50" />&lt;15%</span>
        <span className="flex items-center gap-1 ml-2"><AlertTriangle className="h-3 w-3 text-red-500" />Below floor price</span>
      </div>

      {/* Matrix Table */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[180px] border-r">
                SKU
              </th>
              <th className="text-right px-2 py-2.5 font-semibold text-muted-foreground min-w-[80px] border-r">
                Landed Cost
              </th>
              {channelList.map((ch) => (
                <th key={ch.id} className="text-center px-1 py-2.5 font-semibold text-muted-foreground min-w-[110px] border-r last:border-r-0">
                  {ch.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && skuRows.length === 0 ? (
              <tr>
                <td colSpan={2 + channelList.length} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading pricing matrix…
                </td>
              </tr>
            ) : skuRows.length === 0 ? (
              <tr>
                <td colSpan={2 + channelList.length} className="text-center py-12 text-muted-foreground">
                  No SKUs found
                </td>
              </tr>
            ) : (
              skuRows.map(({ sku, pricing }) => (
                <tr key={sku.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                  {/* SKU info */}
                  <td className="px-3 py-0 sticky left-0 bg-background border-r z-10">
                    <div className="py-1.5">
                      <div className="font-mono font-semibold text-primary text-xs leading-none">{sku.sku}</div>
                      {sku.description && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[160px] mt-0.5 leading-none">{sku.description}</div>
                      )}
                      {sku.productGroup && (
                        <div className="text-[9px] text-muted-foreground/60 mt-0.5 leading-none">{sku.productGroup}</div>
                      )}
                    </div>
                  </td>
                  {/* Landed cost */}
                  <td className="px-2 py-0 text-right border-r">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {pricing?.landedCost ? `$${Number(pricing.landedCost).toFixed(2)}` : "—"}
                    </span>
                  </td>
                  {/* Channel price cells */}
                  {channelList.map((ch) => {
                    const cp = priceMap.get(sku.id)?.get(ch.id) ?? null;
                    return (
                      <td key={ch.id} className="p-0 border-r last:border-r-0">
                        <CellEditPopover
                          skuId={sku.id}
                          channelId={ch.id}
                          channelName={ch.name}
                          skuCode={sku.sku}
                          landedCost={pricing?.landedCost}
                          existing={cp}
                          onSaved={refresh}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 py-1 text-xs">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChannelPricing() {
  const [activeTab, setActiveTab] = useState<"online" | "wholesale">("online");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Channel Pricing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set and manage prices across online storefronts and wholesale partners. Click any cell to edit.
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "online" | "wholesale")}>
          <TabsList className="h-8">
            <TabsTrigger value="online" className="text-xs px-4">Online Storefronts</TabsTrigger>
            <TabsTrigger value="wholesale" className="text-xs px-4">Wholesale Partners</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <PricingMatrix key={activeTab} channelType={activeTab} />
    </div>
  );
}
