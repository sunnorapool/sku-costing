import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
  return `${(n * 100).toFixed(2)}%`;
}

function marginClass(val: string | null | undefined): string {
  if (!val) return "text-muted-foreground";
  const n = parseFloat(val);
  if (isNaN(n)) return "text-muted-foreground";
  if (n > 0) return "text-emerald-600 font-medium";
  if (n < 0) return "text-red-500 font-medium";
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
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  done: "bg-blue-50 text-blue-700 border-blue-200",
  new_model: "bg-amber-50 text-amber-700 border-amber-200",
  missing: "bg-red-50 text-red-700 border-red-200",
  discontinued: "bg-gray-100 text-gray-500 border-gray-200",
};

const FIELD_LABELS: Record<string, string> = {
  srp2023: "SRP 2023",
  srp2024: "SRP 2024",
  map: "MAP",
  comps2024: "2024 Comps",
  srp2024Amzn: "SRP 2024 (AMZN)",
  wholesalePoolCity: "Wholesale (Pool City)",
  bdWholesaleMarginPct: "BD Wholesale Margin %",
  fob26Costing: "FOB 26 Costing",
  factoryCost: "Factory Cost",
  pptg25WholesalePrice: "PPTG 25 Wholesale",
  bdWholesaleRetail24: "BD Wholesale Retail 24",
  bdWholesaleRetail25: "BD Wholesale Retail 25",
  adjusted: "Adjusted",
  inc2425Pct: "Inc 24-25%",
  bdMargin: "BD Margin",
  bdMarginPct: "BD Margin %",
  landedCost: "Landed Cost",
  landedPlusBdFees: "Landed + BD Fees",
  margin: "Margin",
};

// ─── AI Prompt Panel ──────────────────────────────────────────────────────────
function AIPromptPanel({ onApplied }: { onApplied: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [prompt, setPrompt] = useState("");
  const [previewData, setPreviewData] = useState<{
    summary: string;
    affectedCount: number;
    changes: AiChange[];
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const previewMutation = trpc.ai.prompt.useMutation();
  const applyMutation = trpc.ai.prompt.useMutation();

  const handlePreview = async () => {
    if (!prompt.trim()) return;
    try {
      const result = await previewMutation.mutateAsync({ prompt, preview: true });
      setPreviewData(result);
      setShowPreview(true);
    } catch (e: any) {
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
      onApplied();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to apply changes");
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Pricing Assistant</h2>
          <p className="text-xs text-muted-foreground">Use natural language to make bulk changes to SKU pricing data</p>
        </div>
        {!isAdmin && (
          <Badge variant="outline" className="ml-auto text-xs">Read-only</Badge>
        )}
      </div>

      {isAdmin ? (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-white border-primary/20 focus:border-primary text-sm"
              placeholder='e.g. "Increase all heat pump SRP 2024 prices by 10%" or "Set MAP for above-ground pumps to match SRP 2024"'
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handlePreview()}
              disabled={previewMutation.isPending}
            />
          </div>
          <Button
            onClick={handlePreview}
            disabled={!prompt.trim() || previewMutation.isPending}
            className="shrink-0"
          >
            {previewMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Preview Changes</>
            )}
          </Button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground bg-white/60 rounded-lg px-3 py-2 border border-primary/10">
          AI prompt editing is available to admin users only. Contact your administrator to make bulk pricing changes.
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Preview AI Changes
            </DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="flex-1 overflow-hidden flex flex-col gap-3">
              <div className="bg-primary/5 rounded-lg px-4 py-3 border border-primary/10">
                <p className="text-sm font-medium text-foreground">{previewData.summary}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {previewData.affectedCount} SKU{previewData.affectedCount !== 1 ? "s" : ""} will be affected · {previewData.changes.length} field change{previewData.changes.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="overflow-auto flex-1 rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">SKU</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Description</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Field</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Old Value</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.changes.map((change, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono font-medium">{change.sku}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{change.description}</td>
                        <td className="px-3 py-2">{FIELD_LABELS[change.field] ?? change.field}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground line-through">{change.oldValue ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-600">{change.newValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              <X className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={applyMutation.isPending}
              className="bg-primary"
            >
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

// ─── Main SKU Table Page ──────────────────────────────────────────────────────
export default function SKUTable() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [productGroup, setProductGroup] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const [editingSku, setEditingSku] = useState<SkuRow | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SkuRow | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.skus.list.useQuery({
    search: search || undefined,
    productGroup: productGroup || undefined,
    status: statusFilter || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: productGroups } = trpc.skus.productGroups.useQuery();

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

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col h-full gap-0">
      {/* AI Prompt Panel */}
      <AIPromptPanel onApplied={handleRefresh} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search SKU or description..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>

        <Select value={productGroup || "_all"} onValueChange={v => { setProductGroup(v === "_all" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-9 w-[200px] text-sm">
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
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        {isAdmin && (
          <Button size="sm" className="h-9 ml-auto" onClick={() => setAddingNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add SKU
          </Button>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
        <span>{total.toLocaleString()} SKUs total</span>
        {(search || productGroup || statusFilter) && (
          <span className="text-primary">· Filtered</span>
        )}
        {isAdmin && (
          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 ml-auto">
            Admin Mode
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-border shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <Search className="h-10 w-10 opacity-20" />
            <p className="text-sm">No SKUs found</p>
            {(search || productGroup || statusFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setProductGroup(""); setStatusFilter(""); }}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse sku-table">
            <thead>
              <tr>
                {/* SKU Info Group */}
                <th className="col-sticky px-3 py-2.5 text-left border-b border-r bg-slate-100 min-w-[80px]">SKU</th>
                <th className="col-sticky-2 px-3 py-2.5 text-left border-b border-r bg-slate-100 min-w-[280px]">Description</th>
                <th className="px-3 py-2.5 text-left border-b bg-slate-100 min-w-[130px]">Product Group</th>
                <th className="px-3 py-2.5 text-left border-b bg-slate-100 min-w-[80px]">Var 1</th>
                <th className="px-3 py-2.5 text-left border-b bg-slate-100 min-w-[80px]">Var 2</th>
                <th className="px-3 py-2.5 text-left border-b bg-slate-100 min-w-[100px]">Status</th>
                {/* Pricing Group */}
                <th className="px-3 py-2.5 text-right border-b border-l bg-blue-50 min-w-[90px]">SRP 2023</th>
                <th className="px-3 py-2.5 text-right border-b bg-blue-50 min-w-[90px]">SRP 2024</th>
                <th className="px-3 py-2.5 text-right border-b bg-blue-50 min-w-[90px]">MAP</th>
                <th className="px-3 py-2.5 text-right border-b bg-blue-50 min-w-[100px]">2024 Comps</th>
                <th className="px-3 py-2.5 text-right border-b bg-blue-50 min-w-[120px]">SRP 2024 (AMZN)</th>
                <th className="px-3 py-2.5 text-right border-b bg-blue-50 min-w-[140px]">Wholesale (Pool City)</th>
                <th className="px-3 py-2.5 text-right border-b bg-blue-50 min-w-[140px]">BD Wholesale Margin %</th>
                {/* Cost Group */}
                <th className="px-3 py-2.5 text-right border-b border-l bg-amber-50 min-w-[110px]">FOB 26 Costing</th>
                <th className="px-3 py-2.5 text-right border-b bg-amber-50 min-w-[100px]">Factory Cost</th>
                <th className="px-3 py-2.5 text-right border-b bg-amber-50 min-w-[140px]">PPTG 25 Wholesale</th>
                <th className="px-3 py-2.5 text-right border-b bg-amber-50 min-w-[150px]">BD Wholesale Retail 24</th>
                <th className="px-3 py-2.5 text-right border-b bg-amber-50 min-w-[150px]">BD Wholesale Retail 25</th>
                <th className="px-3 py-2.5 text-right border-b bg-amber-50 min-w-[100px]">Adjusted</th>
                <th className="px-3 py-2.5 text-right border-b bg-amber-50 min-w-[100px]">Inc 24-25%</th>
                {/* Margin Group */}
                <th className="px-3 py-2.5 text-right border-b border-l bg-emerald-50 min-w-[100px]">BD Margin</th>
                <th className="px-3 py-2.5 text-right border-b bg-emerald-50 min-w-[100px]">BD Margin %</th>
                <th className="px-3 py-2.5 text-right border-b bg-emerald-50 min-w-[110px]">Landed Cost</th>
                <th className="px-3 py-2.5 text-right border-b bg-emerald-50 min-w-[130px]">Landed + BD Fees</th>
                <th className="px-3 py-2.5 text-right border-b bg-emerald-50 min-w-[90px]">Margin</th>
                {/* Tariff & Duty Group */}
                <th className="px-3 py-2.5 text-right border-b border-l bg-orange-50 min-w-[90px]">Tariff %</th>
                <th className="px-3 py-2.5 text-right border-b bg-orange-50 min-w-[100px]">Tariff Amt</th>
                <th className="px-3 py-2.5 text-right border-b bg-orange-50 min-w-[80px]">Duty %</th>
                <th className="px-3 py-2.5 text-right border-b bg-orange-50 min-w-[90px]">Duty Amt</th>
                {/* Freight & Fees Group */}
                <th className="px-3 py-2.5 text-right border-b border-l bg-purple-50 min-w-[90px]">Freight</th>
                <th className="px-3 py-2.5 text-right border-b bg-purple-50 min-w-[90px]">Freight Alt</th>
                <th className="px-3 py-2.5 text-right border-b bg-purple-50 min-w-[80px]">Load %</th>
                <th className="px-3 py-2.5 text-right border-b bg-purple-50 min-w-[120px]">BD License Fee %</th>
                <th className="px-3 py-2.5 text-right border-b bg-purple-50 min-w-[110px]">Asia Margin %</th>
                <th className="px-3 py-2.5 text-right border-b bg-purple-50 min-w-[80px]">BD Fee</th>
                {/* Notes */}
                <th className="px-3 py-2.5 text-left border-b border-l bg-slate-50 min-w-[200px]">Notes</th>
                {isAdmin && <th className="px-3 py-2.5 text-center border-b border-l bg-slate-100 min-w-[80px]">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr
                  key={row.sku.id}
                  className={`border-b hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/50"}`}
                >
                  <td className="col-sticky px-3 py-2 border-r font-mono text-xs font-semibold text-primary">
                    {row.sku.sku}
                  </td>
                  <td className="col-sticky-2 px-3 py-2 border-r text-xs max-w-[280px]">
                    <span className="block truncate" title={row.sku.description ?? ""}>
                      {row.sku.description ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.sku.productGroup ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.sku.var1 ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.sku.var2 ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${STATUS_COLORS[row.sku.status]}`}>
                      {STATUS_LABELS[row.sku.status]}
                    </span>
                  </td>
                  {/* Pricing */}
                  <td className="px-3 py-2 text-right text-xs border-l">{fmt(row.pricing?.srp2023)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.srp2024)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.map)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.comps2024)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.srp2024Amzn)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.wholesalePoolCity)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtPct(row.pricing?.bdWholesaleMarginPct)}</td>
                  {/* Costs */}
                  <td className="px-3 py-2 text-right text-xs border-l">{fmt(row.pricing?.fob26Costing)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.factoryCost)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.pptg25WholesalePrice)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.bdWholesaleRetail24)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.bdWholesaleRetail25)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.adjusted)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtPct(row.pricing?.inc2425Pct)}</td>
                  {/* Margins */}
                  <td className={`px-3 py-2 text-right text-xs border-l ${marginClass(row.pricing?.bdMargin)}`}>{fmt(row.pricing?.bdMargin)}</td>
                  <td className={`px-3 py-2 text-right text-xs ${marginClass(row.pricing?.bdMarginPct)}`}>{fmtPct(row.pricing?.bdMarginPct)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.landedCost)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(row.pricing?.landedPlusBdFees)}</td>
                  <td className={`px-3 py-2 text-right text-xs ${marginClass(row.pricing?.margin)}`}>{fmt(row.pricing?.margin)}</td>
                  {/* Tariff & Duty */}
                  <td className="px-3 py-2 text-right text-xs border-l">{fmtPct((row.pricing as any)?.tariffPct)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt((row.pricing as any)?.tariffAmt)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtPct((row.pricing as any)?.dutyPct)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt((row.pricing as any)?.dutyAmt)}</td>
                  {/* Freight & Fees */}
                  <td className="px-3 py-2 text-right text-xs border-l">{fmt((row.pricing as any)?.freight)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt((row.pricing as any)?.freightAlt)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtPct((row.pricing as any)?.loadPct)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtPct((row.pricing as any)?.bdLicenseFeePct)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtPct((row.pricing as any)?.asiaMarginPct)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt((row.pricing as any)?.bdFee)}</td>
                  {/* Notes */}
                  <td className="px-3 py-2 text-xs border-l text-muted-foreground max-w-[200px]">
                    <span className="block truncate" title={(row.pricing as any)?.notes ?? ""}>
                      {(row.pricing as any)?.notes ?? "—"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 border-l">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                          onClick={() => setEditingSku(row)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-red-50 hover:text-red-500"
                          onClick={() => setDeleteConfirm(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
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
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add SKU Dialog */}
      {addingNew && (
        <AddSKUDialog
          open={addingNew}
          onClose={() => setAddingNew(false)}
          onSaved={() => { setAddingNew(false); utils.skus.list.invalidate(); }}
        />
      )}

      {/* Edit SKU Dialog */}
      {editingSku && (
        <EditSKUDialog
          open={!!editingSku}
          sku={editingSku}
          onClose={() => setEditingSku(null)}
          onSaved={() => { setEditingSku(null); utils.skus.list.invalidate(); }}
        />
      )}

      {/* Delete Confirm Dialog */}
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
