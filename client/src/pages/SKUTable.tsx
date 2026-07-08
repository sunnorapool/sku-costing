import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Edit2,
  Filter,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
  Eye,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import AddSKUDialog from "@/components/AddSKUDialog";
import EditSKUDialog from "@/components/EditSKUDialog";

// ─── Types ────────────────────────────────────────────────────────────────────
type SkuRow = {
  sku: {
    id: number;
    sku: string;
    description: string | null;
    productGroup: string | null;
    var1: string | null;
    var2: string | null;
    status: "active" | "done" | "new_model" | "missing" | "discontinued";
    sortOrder: number | null;
    supplier: string | null;
    htsCode: string | null;
    sourceStatus: string | null;
    isBd: string | null;
    salesQty2024Ytd: string | null;
    avgPrice2024Ytd: string | null;
    salesAmt2024Ytd: string | null;
    cartonL: string | null;
    cartonW: string | null;
    cartonH: string | null;
    grossWtKg: string | null;
    netWtKg: string | null;
    pcsPerCarton: string | null;
    packingType: string | null;
    cartonCount: number | null;
    createdAt: Date;
    updatedAt: Date;
  };
  pricing: {
    id: number;
    skuId: number;
    srp2023: string | null;
    srp2024: string | null;
    map: string | null;
    comps2024: string | null;
    srp2024Amzn: string | null;
    wholesalePoolCity: string | null;
    bdWholesaleMarginPct: string | null;
    fob26Costing: string | null;
    factoryCost: string | null;
    pptg25WholesalePrice: string | null;
    bdWholesaleRetail24: string | null;
    bdWholesaleRetail25: string | null;
    adjusted: string | null;
    inc2425Pct: string | null;
    bdMargin: string | null;
    bdMarginPct: string | null;
    landedCost: string | null;
    landedPlusBdFees: string | null;
    margin: string | null;
    [key: string]: string | number | null | undefined;
  } | null;
};

type AiChange = {
  skuId: number;
  sku: string;
  description: string;
  field: string;
  oldValue: string | null;
  newValue: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val: string | null | undefined, prefix = "$"): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function marginPctClass(val: string | null | undefined): string {
  if (!val) return "text-muted-foreground";
  const n = parseFloat(val);
  if (isNaN(n)) return "text-muted-foreground";
  const pct = n * 100;
  if (pct >= 35) return "margin-great";
  if (pct >= 25) return "margin-good";
  if (pct >= 15) return "margin-ok";
  if (pct >= 0)  return "margin-low";
  return "margin-bad";
}

function marginDollarClass(val: string | null | undefined): string {
  if (!val) return "text-muted-foreground";
  const n = parseFloat(val);
  if (isNaN(n)) return "text-muted-foreground";
  if (n > 0) return "text-emerald-700 font-medium";
  if (n < 0) return "margin-bad";
  return "text-muted-foreground";
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  done: "Done",
  new_model: "New Model",
  missing: "Missing",
  discontinued: "Discontinued",
};

const STATUS_COLORS: Record<string, string> = {
  active:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  done:         "bg-blue-50 text-blue-700 border-blue-200",
  new_model:    "bg-amber-50 text-amber-700 border-amber-200",
  missing:      "bg-red-50 text-red-700 border-red-200",
  discontinued: "bg-gray-100 text-gray-500 border-gray-200",
};

const FIELD_LABELS: Record<string, string> = {
  srp2023: "SRP 2023", srp2024: "SRP 2024", map: "MAP",
  comps2024: "2024 Comps", srp2024Amzn: "SRP 2024 (AMZN)",
  wholesalePoolCity: "Wholesale (Pool City)", bdWholesaleMarginPct: "BD Wholesale Margin %",
  fob26Costing: "FOB 26 Costing", factoryCost: "Factory Cost",
  pptg25WholesalePrice: "PPTG 25 Wholesale", bdWholesaleRetail24: "BD Wholesale Retail 24",
  bdWholesaleRetail25: "BD Wholesale Retail 25", adjusted: "Adjusted",
  inc2425Pct: "Inc 24-25%", bdMargin: "BD Margin", bdMarginPct: "BD Margin %",
  landedCost: "Landed Cost", landedPlusBdFees: "Landed + BD Fees", margin: "Margin",
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div className="skeleton h-4 w-20 shrink-0" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-4 w-28 shrink-0" />
          <div className="skeleton h-4 w-16 shrink-0" />
          <div className="skeleton h-4 w-20 shrink-0" />
          <div className="skeleton h-4 w-20 shrink-0" />
          <div className="skeleton h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── AI Prompt Panel ──────────────────────────────────────────────────────────
type AIMode = "edit" | "filter";

function AIPromptPanel({
  onApplied,
  onFilter,
  onClearFilter,
}: {
  onApplied: () => void;
  onFilter: (ids: number[]) => void;
  onClearFilter: () => void;
}) {
  const [mode, setMode] = useState<AIMode>("edit");
  const [prompt, setPrompt] = useState("");
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [previewData, setPreviewData] = useState<{
    summary: string;
    affectedCount: number;
    changes: AiChange[];
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [filterActive, setFilterActive] = useState(false);

  const previewMutation = trpc.ai.prompt.useMutation();
  const applyMutation = trpc.ai.prompt.useMutation();
  const filterMutation = trpc.ai.filter.useMutation();

  // Simulate streaming by revealing the summary word-by-word
  const simulateStream = (text: string, onDone: () => void) => {
    setIsStreaming(true);
    setStreamedText("");
    const words = text.split(" ");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setStreamedText(words.slice(0, i).join(" "));
      if (i >= words.length) {
        clearInterval(interval);
        setIsStreaming(false);
        onDone();
      }
    }, 40);
  };

  const handlePreview = async () => {
    if (!prompt.trim()) return;

    if (mode === "filter") {
      try {
        setIsStreaming(true);
        setStreamedText("Analyzing your query...");
        const result = await filterMutation.mutateAsync({ prompt });
        simulateStream(result.explanation, () => {
          onFilter(result.matchingIds);
          setFilterActive(true);
        });
      } catch (e: any) {
        setIsStreaming(false);
        toast.error(e.message ?? "Failed to filter");
      }
      return;
    }

    try {
      setStreamedText("Analyzing your pricing instruction...");
      setIsStreaming(true);
      const result = await previewMutation.mutateAsync({ prompt, preview: true });
      simulateStream(result.summary, () => {
        setPreviewData(result);
        setShowPreview(true);
      });
    } catch (e: any) {
      setIsStreaming(false);
      toast.error(e.message ?? "Failed to generate preview");
    }
  };

  const handleApply = async () => {
    if (!previewData) return;
    try {
      await applyMutation.mutateAsync({ prompt, preview: false });
      toast.success(`Applied changes to ${previewData.affectedCount} SKUs`);
      setShowPreview(false);
      setPreviewData(null);
      setPrompt("");
      setStreamedText("");
      onApplied();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to apply changes");
    }
  };

  const handleClearFilter = () => {
    setFilterActive(false);
    setStreamedText("");
    setPrompt("");
    onClearFilter();
  };

  const isPending = previewMutation.isPending || filterMutation.isPending || isStreaming;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-[oklch(0.165_0.04_255)/0.03] to-[oklch(0.48_0.22_255)/0.05] p-4 mb-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground leading-none">AI Pricing Assistant</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === "edit"
              ? "Make bulk pricing changes with natural language"
              : "Filter the table by describing what you want to see"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 shrink-0">
          <button
            onClick={() => { setMode("edit"); setStreamedText(""); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "edit"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-3 w-3" />
            Edit Mode
          </button>
          <button
            onClick={() => { setMode("filter"); setStreamedText(""); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "filter"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3 w-3" />
            Filter Mode
          </button>
        </div>
      </div>

      <div className="space-y-2">
          {/* Input row */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 bg-white/80 border-primary/20 focus:border-primary text-sm h-10"
                placeholder={
                  mode === "edit"
                    ? 'e.g. "Increase all Heat Pump SRP 2024 by 10%" or "Set MAP = SRP 2024 for Sand Filters"'
                    : 'e.g. "Show Heat Pumps where BD Margin % is below 20%"'
                }
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && !isPending && handlePreview()}
                disabled={isPending}
              />
            </div>
            <Button
              onClick={handlePreview}
              disabled={!prompt.trim() || isPending}
              className="shrink-0 h-10"
              variant={mode === "filter" ? "outline" : "default"}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Thinking...</>
              ) : mode === "edit" ? (
                <><Sparkles className="h-4 w-4 mr-2" />Preview Changes</>
              ) : (
                <><Eye className="h-4 w-4 mr-2" />Apply Filter</>
              )}
            </Button>
            {filterActive && (
              <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" onClick={handleClearFilter}>
                <X className="h-4 w-4 mr-1" />Clear
              </Button>
            )}
          </div>

          {/* Streaming response */}
          {streamedText && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-sm ${
              mode === "filter"
                ? "bg-blue-50/60 border-blue-200/60 text-blue-800"
                : "bg-primary/5 border-primary/15 text-foreground"
            }`}>
              <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <span className={isStreaming ? "ai-cursor" : ""}>{streamedText}</span>
            </div>
          )}
        </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              Preview Pricing Changes
            </DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="flex-1 overflow-hidden flex flex-col gap-0 px-6 py-4">
              {/* Summary */}
              <div className="bg-primary/5 rounded-xl px-4 py-3 border border-primary/10 mb-3">
                <p className="text-sm font-medium text-foreground">{previewData.summary}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{previewData.affectedCount}</strong> SKU{previewData.affectedCount !== 1 ? "s" : ""} affected
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{previewData.changes.length}</strong> field change{previewData.changes.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Changes table */}
              <div className="overflow-auto flex-1 rounded-xl border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b sticky top-0">
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">SKU</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Description</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Field</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Current Value</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">New Value</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.changes.map((change, i) => {
                      const oldN = parseFloat(change.oldValue ?? "");
                      const newN = parseFloat(change.newValue);
                      const delta = !isNaN(oldN) && !isNaN(newN) ? newN - oldN : null;
                      const deltaPct = delta !== null && oldN !== 0 ? (delta / Math.abs(oldN)) * 100 : null;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-mono font-semibold text-primary">{change.sku}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{change.description}</td>
                          <td className="px-3 py-2">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {FIELD_LABELS[change.field] ?? change.field}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground line-through">
                            {change.oldValue ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                            {change.newValue}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {deltaPct !== null ? (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                deltaPct > 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-600"
                              }`}>
                                {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              <X className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button onClick={handleApply} disabled={applyMutation.isPending}>
              {applyMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Apply {previewData?.affectedCount} Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Column Group Header Row ──────────────────────────────────────────────────
function ColGroupHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <tr>
      <th colSpan={6} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-sku border-b border-r">
        SKU Info
      </th>
      <th colSpan={7} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-pricing border-b border-l">
        Pricing
      </th>
      <th colSpan={7} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-costs border-b border-l">
        Costs
      </th>
      <th colSpan={5} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-margins border-b border-l">
        Margins
      </th>
      <th colSpan={4} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-tariff border-b border-l">
        Tariff &amp; Duty
      </th>
      <th colSpan={6} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-freight border-b border-l">
        Freight &amp; Fees
      </th>
      <th colSpan={1} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-notes border-b border-l">
        Notes
      </th>
      <th colSpan={7} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider bg-teal-50/80 text-teal-700 border-b border-l">
        Sourcing Info
      </th>
      {isAdmin && (
        <th className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider col-group-sku border-b border-l">
          Actions
        </th>
      )}
    </tr>
  );
}

// ─── Main SKU Table Page ──────────────────────────────────────────────────────
export default function SKUTable() {
  const [search, setSearch] = useState("");
  const [productGroup, setProductGroup] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [brandFilter, setBrandFilter] = useState<string>(() => localStorage.getItem("sku-brand-filter") ?? "");
  const [sourceStatusFilter, setSourceStatusFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [aiFilterIds, setAiFilterIds] = useState<number[] | null>(null);
  const [cartonDetailSkuId, setCartonDetailSkuId] = useState<number | null>(null);
  const [cartonDetailSkuLabel, setCartonDetailSkuLabel] = useState<string>("");

  const BRANDS = [
    { label: "All", value: "" },
    { label: "BD", value: "BD" },
    { label: "Sunnora", value: "Sunnora" },
    { label: "Blue Torrent", value: "BT" },
  ];

  const handleBrandFilter = (v: string) => {
    setBrandFilter(v);
    localStorage.setItem("sku-brand-filter", v);
    setPage(0);
  };
  const PAGE_SIZE = 100;

  const [editingSku, setEditingSku] = useState<SkuRow | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SkuRow | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.skus.list.useQuery({
    search: search || undefined,
    productGroup: productGroup || undefined,
    status: statusFilter || undefined,
    brand: brandFilter || undefined,
    sourceStatus: sourceStatusFilter || undefined,
    supplier: supplierFilter || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ids: aiFilterIds ?? undefined,
  });

  const { data: productGroups } = trpc.skus.productGroups.useQuery();
  const { data: sourceStatuses } = trpc.skus.sourceStatuses.useQuery();
  const { data: suppliers } = trpc.skus.suppliers.useQuery();

  const { data: cartonDetails, isLoading: cartonDetailsLoading } = trpc.skus.cartonDetails.useQuery(
    { skuId: cartonDetailSkuId! },
    { enabled: cartonDetailSkuId !== null }
  );

  const deleteMutation = trpc.skus.delete.useMutation({
    onSuccess: () => {
      toast.success("SKU deleted");
      setDeleteConfirm(null);
      utils.skus.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const items: SkuRow[] = (data?.items ?? []) as SkuRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleRefresh = useCallback(() => refetch(), [refetch]);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* AI Prompt Panel */}
      <AIPromptPanel
        onApplied={handleRefresh}
        onFilter={(ids) => { setAiFilterIds(ids); setPage(0); }}
        onClearFilter={() => { setAiFilterIds(null); setPage(0); }}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm bg-white"
            placeholder="Search SKU or description..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>

        <Select value={productGroup || "_all"} onValueChange={v => { setProductGroup(v === "_all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[200px] text-sm bg-white">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Product Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Product Groups</SelectItem>
            {(productGroups ?? []).map(g => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter || "_all"} onValueChange={v => { setStatusFilter(v === "_all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[160px] text-sm bg-white">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceStatusFilter || "_all"} onValueChange={v => { setSourceStatusFilter(v === "_all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[200px] text-sm bg-white">
            <SelectValue placeholder="All Source Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Source Statuses</SelectItem>
            {(sourceStatuses ?? []).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={supplierFilter || "_all"} onValueChange={v => { setSupplierFilter(v === "_all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[160px] text-sm bg-white">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Suppliers</SelectItem>
            {(suppliers ?? []).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        {/* Brand filter toggles */}
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-white">
          {BRANDS.map(b => (
            <button
              key={b.value}
              onClick={() => handleBrandFilter(b.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                brandFilter === b.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <Button size="sm" className="h-9 ml-auto" onClick={() => setAddingNew(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add SKU
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-muted-foreground">
          <strong className="text-foreground">{total.toLocaleString()}</strong> SKUs
          {(search || productGroup || statusFilter || brandFilter || aiFilterIds) && (
            <span className="text-primary ml-1">· Filtered</span>
          )}
          {brandFilter && (
            <span className="ml-1 text-primary font-medium">· Brand: {BRANDS.find(b => b.value === brandFilter)?.label}</span>
          )}
          {aiFilterIds && (
            <span className="ml-2 text-blue-600 font-medium">· AI Filter active ({aiFilterIds.length} matched)</span>
          )}
        </span>

      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-border shadow-sm bg-white">
        {isLoading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <Search className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">No SKUs found</p>
            {(search || productGroup || statusFilter || aiFilterIds) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setSearch(""); setProductGroup(""); setStatusFilter(""); setAiFilterIds(null);
              }}>
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20">
              <ColGroupHeader isAdmin={true} />
              <tr className="bg-slate-50 border-b">
                {/* SKU Info */}
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-r min-w-[90px] bg-slate-50">SKU</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-r min-w-[260px] bg-slate-50">Description</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground min-w-[130px] bg-slate-50">Product Group</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground min-w-[70px] bg-slate-50">Var 1</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground min-w-[70px] bg-slate-50">Var 2</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground min-w-[90px] bg-slate-50">Status</th>
                {/* Pricing */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground border-l min-w-[85px] bg-blue-50/60">SRP 2023</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[85px] bg-blue-50/60">SRP 2024</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[85px] bg-blue-50/60">MAP</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[90px] bg-blue-50/60">2024 Comps</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[115px] bg-blue-50/60">SRP 2024 AMZN</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[130px] bg-blue-50/60">Wholesale (Pool City)</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[130px] bg-blue-50/60">BD Wholesale Margin %</th>
                {/* Costs */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground border-l min-w-[105px] bg-amber-50/60">FOB 26 Costing</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[95px] bg-amber-50/60">Factory Cost</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[130px] bg-amber-50/60">PPTG 25 Wholesale</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[140px] bg-amber-50/60">BD Retail 24</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[140px] bg-amber-50/60">BD Retail 25</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[90px] bg-amber-50/60">Adjusted</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[90px] bg-amber-50/60">Inc 24-25%</th>
                {/* Margins */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground border-l min-w-[95px] bg-emerald-50/60">BD Margin</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[95px] bg-emerald-50/60">BD Margin %</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[105px] bg-emerald-50/60">Landed Cost</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[125px] bg-emerald-50/60">Landed + BD Fees</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[85px] bg-emerald-50/60">Margin</th>
                {/* Tariff & Duty */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground border-l min-w-[80px] bg-orange-50/60">Tariff %</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[90px] bg-orange-50/60">Tariff Amt</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[75px] bg-orange-50/60">Duty %</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[85px] bg-orange-50/60">Duty Amt</th>
                {/* Freight & Fees */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground border-l min-w-[85px] bg-purple-50/60">Freight</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[85px] bg-purple-50/60">Freight Alt</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[75px] bg-purple-50/60">Load %</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[115px] bg-purple-50/60">BD License Fee %</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[100px] bg-purple-50/60">Asia Margin %</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[75px] bg-purple-50/60">BD Fee</th>
                {/* Notes */}
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-l min-w-[180px] bg-slate-50">Notes</th>
                {/* Sourcing Info */}
                <th className="px-3 py-2 text-left text-xs font-semibold text-teal-700 border-l min-w-[110px] bg-teal-50/60">Supplier</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-teal-700 min-w-[110px] bg-teal-50/60">HTS Code</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-teal-700 min-w-[140px] bg-teal-50/60">Source Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-teal-700 min-w-[60px] bg-teal-50/60">B&amp;D?</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-teal-700 min-w-[80px] bg-teal-50/60">Packing</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-teal-700 min-w-[120px] bg-teal-50/60">Sales Qty YTD</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-teal-700 min-w-[120px] bg-teal-50/60">Sales Amt YTD</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground border-l min-w-[80px] bg-slate-50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr
                  key={row.sku.id}
                  className={`border-b sku-table-row transition-colors ${idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                >
                  {/* SKU Info */}
                  <td className="px-3 py-2 border-r">
                    <span className="font-mono text-xs font-semibold text-primary">{row.sku.sku}</span>
                  </td>
                  <td className="px-3 py-2 border-r text-xs max-w-[260px]">
                    <span className="block truncate" title={row.sku.description ?? ""}>{row.sku.description ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{row.sku.productGroup ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.sku.var1 ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.sku.var2 ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-semibold ${STATUS_COLORS[row.sku.status]}`}>
                      {STATUS_LABELS[row.sku.status]}
                    </span>
                  </td>
                  {/* Pricing */}
                  <td className="px-3 py-2 text-right text-xs border-l tabular-nums">{fmt(row.pricing?.srp2023)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">{fmt(row.pricing?.srp2024)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.map)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.comps2024)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.srp2024Amzn)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.wholesalePoolCity)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPct(row.pricing?.bdWholesaleMarginPct)}</td>
                  {/* Costs */}
                  <td className="px-3 py-2 text-right text-xs border-l tabular-nums">{fmt(row.pricing?.fob26Costing)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.factoryCost)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.pptg25WholesalePrice)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.bdWholesaleRetail24)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">{fmt(row.pricing?.bdWholesaleRetail25)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.adjusted)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPct(row.pricing?.inc2425Pct)}</td>
                  {/* Margins — color coded */}
                  <td className={`px-3 py-2 text-right text-xs border-l tabular-nums ${marginDollarClass(row.pricing?.bdMargin)}`}>
                    {fmt(row.pricing?.bdMargin)}
                  </td>
                  <td className={`px-3 py-2 text-right text-xs tabular-nums ${marginPctClass(row.pricing?.bdMarginPct)}`}>
                    {fmtPct(row.pricing?.bdMarginPct)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.landedCost)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.pricing?.landedPlusBdFees)}</td>
                  <td className={`px-3 py-2 text-right text-xs tabular-nums ${marginDollarClass(row.pricing?.margin)}`}>
                    {fmt(row.pricing?.margin)}
                  </td>
                  {/* Tariff & Duty */}
                  <td className="px-3 py-2 text-right text-xs border-l tabular-nums">{fmtPct((row.pricing as any)?.tariffPct)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt((row.pricing as any)?.tariffAmt)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPct((row.pricing as any)?.dutyPct)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt((row.pricing as any)?.dutyAmt)}</td>
                  {/* Freight & Fees */}
                  <td className="px-3 py-2 text-right text-xs border-l tabular-nums">{fmt((row.pricing as any)?.freight)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt((row.pricing as any)?.freightAlt)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPct((row.pricing as any)?.loadPct)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPct((row.pricing as any)?.bdLicenseFeePct)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtPct((row.pricing as any)?.asiaMarginPct)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt((row.pricing as any)?.bdFee)}</td>
                  {/* Notes */}
                  <td className="px-3 py-2 text-xs border-l text-muted-foreground max-w-[180px]">
                    <span className="block truncate" title={(row.pricing as any)?.notes ?? ""}>
                      {(row.pricing as any)?.notes ?? "—"}
                    </span>
                  </td>
                  {/* Sourcing Info */}
                  <td className="px-3 py-2 text-xs border-l text-teal-800">{row.sku.supplier ?? "—"}</td>
                  <td className="px-3 py-2 text-xs font-mono text-teal-700">{row.sku.htsCode ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.sku.sourceStatus ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-700 border border-teal-200 font-medium whitespace-nowrap">
                        {row.sku.sourceStatus}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-center">
                    {row.sku.isBd === "Yes" ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold">BD</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-teal-700 font-mono">{row.sku.packingType ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {row.sku.salesQty2024Ytd ? Number(row.sku.salesQty2024Ytd).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {row.sku.salesAmt2024Ytd ? `$${Number(row.sku.salesAmt2024Ytd).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td className="px-3 py-2 border-l">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 hover:bg-teal-50 hover:text-teal-600"
                        title="View carton details"
                        onClick={() => {
                          setCartonDetailSkuId(row.sku.id);
                          setCartonDetailSkuLabel(row.sku.sku);
                        }}
                      >
                        <Package className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                        onClick={() => setEditingSku(row)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 hover:bg-red-50 hover:text-red-500"
                        onClick={() => setDeleteConfirm(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs bg-white" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs bg-white" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {addingNew && (
        <AddSKUDialog
          open={addingNew}
          onClose={() => setAddingNew(false)}
          onSaved={() => { setAddingNew(false); utils.skus.list.invalidate(); }}
        />
      )}
      {editingSku && (
        <EditSKUDialog
          open={!!editingSku}
          sku={editingSku}
          onClose={() => setEditingSku(null)}
          onSaved={() => { setEditingSku(null); utils.skus.list.invalidate(); }}
        />
      )}
      {/* Carton Details Dialog */}
      <Dialog open={cartonDetailSkuId !== null} onOpenChange={() => setCartonDetailSkuId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600" />
              Carton Details — <span className="font-mono text-primary">{cartonDetailSkuLabel}</span>
            </DialogTitle>
          </DialogHeader>
          {cartonDetailsLoading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading carton details…</span>
            </div>
          ) : cartonDetails && cartonDetails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Package className="h-10 w-10 opacity-20" />
              <p className="text-sm">No carton details on file for this SKU.</p>
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-teal-50 border-b">
                    <th className="px-3 py-2 text-left font-semibold text-teal-700">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-teal-700">Label</th>
                    <th className="px-3 py-2 text-left font-semibold text-teal-700">Component SKU</th>
                    <th className="px-3 py-2 text-right font-semibold text-teal-700">Qty</th>
                    <th className="px-3 py-2 text-center font-semibold text-teal-700">Sellable</th>
                    <th className="px-3 py-2 text-right font-semibold text-teal-700">L (cm)</th>
                    <th className="px-3 py-2 text-right font-semibold text-teal-700">W (cm)</th>
                    <th className="px-3 py-2 text-right font-semibold text-teal-700">H (cm)</th>
                    <th className="px-3 py-2 text-right font-semibold text-teal-700">Gross Wt (kg)</th>
                    <th className="px-3 py-2 text-right font-semibold text-teal-700">Net Wt (kg)</th>
                    <th className="px-3 py-2 text-right font-semibold text-teal-700">Pcs/Ctn</th>
                    <th className="px-3 py-2 text-left font-semibold text-teal-700">Packing</th>
                  </tr>
                </thead>
                <tbody>
                  {(cartonDetails ?? []).map((cd: any, i: number) => (
                    <tr key={cd.id ?? i} className={`border-b last:border-0 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                      <td className="px-3 py-2 text-muted-foreground">{cd.cartonNum ?? i + 1}</td>
                      <td className="px-3 py-2 font-medium">{cd.cartonLabel ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-primary">{cd.componentSku ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cd.qtyPerParent ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {cd.componentSellable === "Yes" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Yes</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-50 text-gray-500 border border-gray-200">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{cd.cartonL ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cd.cartonW ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cd.cartonH ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cd.grossWtKg ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cd.netWtKg ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cd.pcsPerCarton ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{cd.packingType ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartonDetailSkuId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete SKU
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground font-mono">{deleteConfirm?.sku.sku}</strong>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm.sku.id })}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
