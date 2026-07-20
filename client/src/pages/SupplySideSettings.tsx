import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  DollarSign,
  Download,
  Edit2,
  ExternalLink,
  HelpCircle,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help shrink-0 inline ml-1" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Freight Config Tab ───────────────────────────────────────────────────────
function FreightConfigTab() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.supplySide["freightConfig.get"].useQuery();
  const upsert = trpc.supplySide["freightConfig.update"].useMutation({
    onSuccess: () => {
      toast.success("Freight config saved");
      utils.supplySide["freightConfig.get"].invalidate();
      setEditingKey(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function openEdit(key: string, currentValue: string) {
    setEditingKey(key);
    setEditValue(currentValue);
  }

  function saveEdit() {
    if (!editingKey) return;
    upsert.mutate({ key: editingKey, value: editValue });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />Loading freight config…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">Freight &amp; Import Fee Configuration</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            These rates are used to calculate the landed cost for every import SKU. Click a row to edit. All changes are logged.
          </p>
        </div>
      </div>

      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Component</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Unit</th>
              <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Current Value</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Formula</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Source</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {(config ?? []).map((row) => (
              <tr key={row.key} className="border-b last:border-0 hover:bg-muted/20 group">
                <td className="px-4 py-2.5 font-medium">
                  {row.label}
                  {row.formulaNote && <InfoTip text={row.formulaNote} />}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.unit}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                  {row.unit?.startsWith("$") || row.unit?.startsWith("%")
                    ? row.unit.startsWith("%")
                      ? `${(Number(row.value) * 100).toFixed(4)}%`
                      : fmt(row.value)
                    : row.value}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-[220px]">
                  <span className="line-clamp-2">{row.formulaNote ?? "—"}</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground max-w-[180px]">
                  <span className="line-clamp-2">{row.sourceNote ?? "—"}</span>
                </td>
                <td className="px-4 py-2.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => openEdit(row.key, row.value)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingKey} onOpenChange={(open) => { if (!open) setEditingKey(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Edit: {(config ?? []).find(r => r.key === editingKey)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">
                Value ({(config ?? []).find(r => r.key === editingKey)?.unit})
              </Label>
              <Input
                className="h-8 text-sm font-mono"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                placeholder="Enter value…"
              />
            </div>
            {(config ?? []).find(r => r.key === editingKey)?.formulaNote && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                {(config ?? []).find(r => r.key === editingKey)?.formulaNote}
              </p>
            )}
            {(config ?? []).find(r => r.key === editingKey)?.sourceNote && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">
                Source: {(config ?? []).find(r => r.key === editingKey)?.sourceNote}
              </p>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingKey(null)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={upsert.isPending}>
                {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── HTS Codes Tab ────────────────────────────────────────────────────────────
function HtsCodesTab() {
  const utils = trpc.useUtils();
  const { data: htsCodes, isLoading } = trpc.supplySide["hts.list"].useQuery();
  const upsert = trpc.supplySide["hts.upsert"].useMutation({
    onSuccess: () => {
      toast.success("HTS code saved");
      utils.supplySide["hts.list"].invalidate();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.supplySide["hts.delete"].useMutation({
    onSuccess: () => {
      toast.success("HTS code removed");
      utils.supplySide["hts.list"].invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState({
    htsCode: "", description: "", baseDutyPct: "0", sec301Pct: "0", sec232Pct: "0", sec122Pct: "0", sourceUrl: "", notes: "",
  });

  function openNew() {
    setForm({ htsCode: "", description: "", baseDutyPct: "0", sec301Pct: "0", sec232Pct: "0", sec122Pct: "0", sourceUrl: "", notes: "" });
    setEditingId("new");
  }

  function openEdit(row: typeof htsCodes extends (infer T)[] | undefined ? T : never) {
    if (!row) return;
    setForm({
      htsCode: (row as { htsCode: string }).htsCode,
      description: (row as { description?: string | null }).description ?? "",
      baseDutyPct: String((row as { baseDutyPct?: string | null }).baseDutyPct ?? "0"),
      sec301Pct: String((row as { sec301Pct?: string | null }).sec301Pct ?? "0"),
      sec232Pct: String((row as { sec232Pct?: string | null }).sec232Pct ?? "0"),
      sec122Pct: String((row as { sec122Pct?: string | null }).sec122Pct ?? "0"),
      sourceUrl: (row as { sourceUrl?: string | null }).sourceUrl ?? "",
      notes: (row as { notes?: string | null }).notes ?? "",
    });
    setEditingId((row as { id: number }).id);
  }

  function save() {
    upsert.mutate({
      id: typeof editingId === "number" ? editingId : undefined,
      htsCode: form.htsCode,
      description: form.description || undefined,
      baseDutyPct: form.baseDutyPct,
      sec301Pct: form.sec301Pct,
      sec232Pct: form.sec232Pct,
      sec122Pct: form.sec122Pct,
      sourceUrl: form.sourceUrl || undefined,
      notes: form.notes || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />Loading HTS codes…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">HTS Tariff Rate Table</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Maps HTS codes to tariff rates. SKUs pull their duty rates from this table by HTS code. All rates are percentages of FOB value.
          </p>
        </div>
        <Button size="sm" className="h-7 text-xs shrink-0" onClick={openNew}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add HTS Code
        </Button>
      </div>

      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">HTS Code</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Description</th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Base Duty
                <InfoTip text="Standard HTS duty rate. Applied to FOB value. Source: HTSUS schedule." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Sec 301
                <InfoTip text="Section 301 China tariff. Applied to FOB value. Source: USTR tariff schedule." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Sec 232
                <InfoTip text="Section 232 steel/aluminum surcharge. Applied to FOB value." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Sec 122
                <InfoTip text="Section 122 additional tariff. Applied to FOB value." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Total</th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Source</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {(htsCodes ?? []).length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No HTS codes yet. Click "Add HTS Code" to add the first one.
                </td>
              </tr>
            ) : (
              (htsCodes ?? []).map((row) => {
                const total = Number(row.baseDutyPct ?? 0) + Number(row.sec301Pct ?? 0) + Number(row.sec232Pct ?? 0) + Number(row.sec122Pct ?? 0);
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 group">
                    <td className="px-3 py-2 font-mono font-medium">{row.htsCode}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[200px]">{row.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{row.baseDutyPct ?? "0"}%</td>
                    <td className="px-3 py-2 text-right">{row.sec301Pct ?? "0"}%</td>
                    <td className="px-3 py-2 text-right">{row.sec232Pct ?? "0"}%</td>
                    <td className="px-3 py-2 text-right">{row.sec122Pct ?? "0"}%</td>
                    <td className="px-3 py-2 text-right font-semibold text-orange-600">{total.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.sourceUrl ? (
                        <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                          Verify <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(row)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Remove this HTS code?")) remove.mutate({ id: row.id }); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Add dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingId === "new" ? "Add HTS Code" : "Edit HTS Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">HTS Code</Label>
                <Input className="h-7 text-xs font-mono" value={form.htsCode} onChange={e => setForm(f => ({ ...f, htsCode: e.target.value }))} placeholder="e.g. 8413.70" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input className="h-7 text-xs" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Product category description" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Base Duty %</Label>
                <Input className="h-7 text-xs font-mono" value={form.baseDutyPct} onChange={e => setForm(f => ({ ...f, baseDutyPct: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section 301 %</Label>
                <Input className="h-7 text-xs font-mono" value={form.sec301Pct} onChange={e => setForm(f => ({ ...f, sec301Pct: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section 232 %</Label>
                <Input className="h-7 text-xs font-mono" value={form.sec232Pct} onChange={e => setForm(f => ({ ...f, sec232Pct: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Section 122 %</Label>
                <Input className="h-7 text-xs font-mono" value={form.sec122Pct} onChange={e => setForm(f => ({ ...f, sec122Pct: e.target.value }))} placeholder="0" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Source URL (optional)</Label>
                <Input className="h-7 text-xs" value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="https://hts.usitc.gov/..." />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input className="h-7 text-xs" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" />
              </div>
            </div>
            <div className="bg-muted/40 rounded p-2 text-xs text-muted-foreground">
              Total tariff: <span className="font-semibold text-orange-600">
                {(Number(form.baseDutyPct || 0) + Number(form.sec301Pct || 0) + Number(form.sec232Pct || 0) + Number(form.sec122Pct || 0)).toFixed(1)}%
              </span> of FOB
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={save} disabled={upsert.isPending || !form.htsCode}>
                {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Snapshots Tab ────────────────────────────────────────────────────────────
function SnapshotsTab() {
  const utils = trpc.useUtils();
  const { data: snapshots, isLoading } = trpc.supplySide["snapshots.list"].useQuery();
  const create = trpc.supplySide["snapshots.save"].useMutation({
    onSuccess: () => {
      toast.success("Snapshot saved");
      utils.supplySide["snapshots.list"].invalidate();
      setCreating(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const restore = trpc.supplySide["snapshots.delete"].useMutation({
    onSuccess: () => {
      toast.success("Snapshot deleted");
      utils.supplySide["snapshots.list"].invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"supply" | "buy">("supply");

  function doCreate() {
    if (!label.trim()) { toast.error("Enter a snapshot label"); return; }
    create.mutate({ label: label.trim(), scope: scope as "supply" | "buy" });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />Loading snapshots…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">Data Snapshots</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save a point-in-time snapshot of the supply side (freight config, HTS rates) or buy side (dealer pricing assumptions, tier discounts). Restore any snapshot to revert to that state.
          </p>
        </div>
        <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => setCreating(true)}>
          <Camera className="h-3.5 w-3.5 mr-1" />Save Snapshot
        </Button>
      </div>

      {(snapshots ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No snapshots yet. Save a snapshot before making major changes so you can revert if needed.
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Label</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Scope</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Saved By</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(snapshots ?? []).map((snap) => (
                <tr key={snap.id} className="border-b last:border-0 hover:bg-muted/20 group">
                  <td className="px-4 py-2.5 font-medium">{snap.label}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={
                      snap.scope === "supply" ? "text-blue-600 border-blue-200" : "text-purple-600 border-purple-200"
                    }>
                      {snap.scope === "supply" ? "Supply Side" : "Buy Side"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{snap.skuCount ?? 0} SKUs</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {snap.createdAt ? new Date(snap.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] px-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete snapshot "${snap.label}"?`)) {
                          restore.mutate({ id: snap.id });
                        }
                      }}
                      disabled={restore.isPending}
                    >
                      <Trash2 className="h-2.5 w-2.5 mr-1" />Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create snapshot dialog */}
      <Dialog open={creating} onOpenChange={(open) => { if (!open) setCreating(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Save Snapshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input className="h-7 text-xs" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Pre-2027 season baseline" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scope</Label>
              <div className="flex gap-2">
                    {(["supply", "buy"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`flex-1 text-xs py-1.5 rounded border transition-colors ${scope === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                  >
                    {s === "supply" ? "Supply Side" : "Buy Side"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={doCreate} disabled={create.isPending || !label.trim()}>
                {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Camera className="h-3 w-3 mr-1" />Save</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Customer PNL Tab ─────────────────────────────────────────────────────────
function CustomerPnlTab() {
  const { data: customers, isLoading: custLoading } = trpc.dealerPricing.getCustomers.useQuery();
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: pnl, isLoading: pnlLoading } = trpc.supplySide["customerHistory.get"].useQuery(
    { customerId: selectedCustomerId!, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { enabled: selectedCustomerId !== null }
  );

  if (custLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />Loading customers…
      </div>
    );
  }

  const customerList = customers ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Customer PNL Analysis</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Compare prior season avg price paid vs. 2027 import/domestic net prices. Shows qty sold, revenue, and margin impact per SKU per customer.
        </p>
      </div>

      {customerList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No customers set up yet. Add customers in the <strong>2027 Dealer Pricing → Customers</strong> tab first.
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Customer list */}
          <div className="w-52 shrink-0 rounded-lg border overflow-auto max-h-[520px]">
            {customerList.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedCustomerId(c.id); setPage(0); }}
                className={`w-full text-left px-3 py-2 text-xs border-b last:border-0 transition-colors ${selectedCustomerId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"}`}
              >
                <div className="font-medium truncate">{c.name}</div>
                <div className={`text-[10px] ${selectedCustomerId === c.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  Tier {c.tier} · {c.sales2025_26 ? `$${Number(c.sales2025_26).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}` : "No sales data"}
                </div>
              </button>
            ))}
          </div>

          {/* PNL table */}
          <div className="flex-1 min-w-0">
            {!selectedCustomerId ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                Select a customer to view their PNL analysis
              </div>
            ) : pnlLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />Computing PNL…
              </div>
            ) : !pnl || pnl.items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                No SKUs with 2024–25 sales history found for this customer.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Showing {pnl.items.length} SKUs with 2024–25 sales history
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      ← Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">Page {page + 1}</span>
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"                     disabled={pnl.items.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
                      Next →
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">SKU</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Description</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                          Qty Sold
                          <InfoTip text="Units sold in the 2024–25 season year-to-date. Source: Ian's sales database." />
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                          Avg Price Paid
                          <InfoTip text="Average price per unit received from this customer in 2024–25. Used as the prior-year baseline." />
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                          2027 Import Net
                          <InfoTip text="2027 import track net price at this customer's tier. Formula: Import List ÷ (1 − Margin% − Royalty%) × (1 − Tier Discount%)." />
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                          2027 Domestic Net
                          <InfoTip text="2027 domestic track net price at this customer's tier. Uses domestic margin rate." />
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                          Price Δ (Import)
                          <InfoTip text="Change from prior avg price paid to 2027 import net. Positive = price increase." />
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">
                          2027 Kept Margin
                          <InfoTip text="Margin % retained at the 2027 import net price. Formula: (Net − Landed Cost) ÷ Net." />
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">FOB Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pnl.items.map((row, i) => {
                        const priceDelta = row.importNet && row.avgPricePaid
                          ? Number(row.importNet) - Number(row.avgPricePaid)
                          : null;
                        const priceDeltaPct = priceDelta && row.avgPricePaid
                          ? priceDelta / Number(row.avgPricePaid)
                          : null;
                        const keptMarginRaw = row.importNet && row.landed2027 && row.importNet > 0
                          ? (row.importNet - row.landed2027) / row.importNet
                          : 0;
                        const marginClass = keptMarginRaw >= 0.35 ? "text-emerald-600" : keptMarginRaw >= 0.25 ? "text-yellow-600" : keptMarginRaw >= 0.15 ? "text-orange-500" : "text-red-500";

                        return (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono font-medium">{row.sku}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">{row.description ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{row.qty2025_26 ? Number(row.qty2025_26).toLocaleString() : "—"}</td>
                            <td className="px-3 py-2 text-right">{row.avgPricePaid ? `$${Number(row.avgPricePaid).toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2 text-right font-medium">{row.importNet ? `$${Number(row.importNet).toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2 text-right">{row.domesticNet ? `$${Number(row.domesticNet).toFixed(2)}` : "—"}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${priceDelta === null ? "" : priceDelta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {priceDelta === null ? "—" : `${priceDelta >= 0 ? "+" : ""}$${priceDelta.toFixed(2)} (${priceDeltaPct !== null ? (priceDeltaPct >= 0 ? "+" : "") + (priceDeltaPct * 100).toFixed(1) + "%" : "—"})`}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${marginClass}`}>
                              {keptMarginRaw > 0 ? `${(keptMarginRaw * 100).toFixed(1)}%` : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.fob2027Status === "confirmed" && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">Confirmed</Badge>
                              )}
                              {row.fob2027Status === "placeholder" && (
                                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-[10px]">Placeholder</Badge>
                              )}
                              {row.fob2027Status === "missing" && (
                                <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px]">Missing</Badge>
                              )}
                              {!row.fob2027Status && <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SupplySideSettings() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Supply Side Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure freight rates, HTS tariff codes, and landed cost inputs. Save snapshots before major changes. View per-customer PNL analysis.
        </p>
      </div>

      <Tabs defaultValue="freight">
        <TabsList className="h-8">
          <TabsTrigger value="freight" className="text-xs h-7 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />Freight Config
          </TabsTrigger>
          <TabsTrigger value="hts" className="text-xs h-7 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />HTS Codes
          </TabsTrigger>
          <TabsTrigger value="pnl" className="text-xs h-7 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />Customer PNL
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="text-xs h-7 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />Snapshots
          </TabsTrigger>
        </TabsList>

        <TabsContent value="freight" className="mt-4">
          <FreightConfigTab />
        </TabsContent>
        <TabsContent value="hts" className="mt-4">
          <HtsCodesTab />
        </TabsContent>
        <TabsContent value="pnl" className="mt-4">
          <CustomerPnlTab />
        </TabsContent>
        <TabsContent value="snapshots" className="mt-4">
          <SnapshotsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
