/**
 * Supply Side — all supply-side inputs only.
 * Contains: Freight & Import Fee Config, HTS Tariff Rate Table.
 * Customer PNL and Market Price Study have moved to Dealers and Reports.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { Edit2, ExternalLink, HelpCircle, Loader2, Plus, Save, Trash2, Truck, DollarSign } from "lucide-react";
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
      <div>
        <h2 className="text-sm font-semibold">Freight &amp; Import Fee Configuration</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every dollar amount here flows directly into the landed cost calculation for each import SKU. Click any row to edit. All changes are logged.
        </p>
      </div>

      {/* Section 122 Toggle */}
      <div className="rounded-lg border p-4 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Section 122 Tariff</span>
              <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {(config ?? []).find(r => r.key === "sec122_enabled")?.value === "0" ? "DISABLED" : "ACTIVE"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              Section 122 is a presidential tariff authority (10% on all imports). Currently set to <strong>indefinitely active</strong> per Dan's direction. Toggle off if it lapses.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-8 text-xs"
            onClick={() => {
              const current = (config ?? []).find(r => r.key === "sec122_enabled");
              const newVal = current?.value === "0" ? "1" : "0";
              upsert.mutate({ key: "sec122_enabled", value: newVal });
            }}
            disabled={upsert.isPending}
          >
            {(config ?? []).find(r => r.key === "sec122_enabled")?.value === "0" ? "Enable Section 122" : "Disable Section 122"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">
                Cost Component
                <InfoTip text="The name of this cost element as it appears in the landed cost formula." />
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Unit</th>
              <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">
                Current Value
                <InfoTip text="The value currently used in all landed cost calculations. Click the pencil icon to edit." />
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">
                How It's Used
                <InfoTip text="Describes how this value is applied in the landed cost formula." />
              </th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">
                Source
                <InfoTip text="Where this value came from (invoice, quote, or estimate)." />
              </th>
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

  function openEdit(row: NonNullable<typeof htsCodes>[number]) {
    setForm({
      htsCode: row.htsCode,
      description: row.description ?? "",
      baseDutyPct: String(row.baseDutyPct ?? "0"),
      sec301Pct: String(row.sec301Pct ?? "0"),
      sec232Pct: String(row.sec232Pct ?? "0"),
      sec122Pct: String(row.sec122Pct ?? "0"),
      sourceUrl: row.sourceUrl ?? "",
      notes: row.notes ?? "",
    });
    setEditingId(row.id);
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
            Each SKU is assigned an HTS (Harmonized Tariff Schedule) code. This table maps each code to its duty rates. The landed cost engine pulls rates from here automatically.
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
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">
                HTS Code
                <InfoTip text="The 10-digit Harmonized Tariff Schedule code that identifies the product category for customs purposes." />
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Description</th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Base Duty
                <InfoTip text="Standard import duty rate from the HTSUS schedule. Applied as a % of FOB value." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Sec 301
                <InfoTip text="Section 301 China tariff. Applied as a % of FOB value. Source: USTR tariff schedule." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Sec 232
                <InfoTip text="Section 232 steel/aluminum surcharge. 50% for steel/aluminum products (CBP 6/4/25). 0% for pool equipment." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Sec 122
                <InfoTip text="Section 122 presidential tariff authority (10%). Applied to the non-232-covered portion of FOB value. Currently active indefinitely per Dan." />
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">
                Total Rate
                <InfoTip text="Sum of all tariff components. This is the total tariff % applied to FOB value in the landed cost calculation." />
              </th>
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
                <Input className="h-7 text-xs font-mono" value={form.htsCode} onChange={e => setForm(f => ({ ...f, htsCode: e.target.value }))} placeholder="e.g. 9506.99.5500" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input className="h-7 text-xs" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Swimming pool equipment" />
              </div>
              {[
                { key: "baseDutyPct", label: "Base Duty %" },
                { key: "sec301Pct", label: "Section 301 %" },
                { key: "sec232Pct", label: "Section 232 %" },
                { key: "sec122Pct", label: "Section 122 %" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    className="h-7 text-xs font-mono"
                    type="number"
                    step="0.01"
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              ))}
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Source URL (optional)</Label>
                <Input className="h-7 text-xs" value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="https://hts.usitc.gov/..." />
              </div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupplySide() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Supply Side</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          All cost inputs that determine how much it costs to land a product in the US. These values feed directly into the landed cost formula used throughout the tool.
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted/40 rounded px-2 py-1 inline-block">
          Landed Cost = FOB + (FOB × Tariff%) + Ocean Freight + Drayage + Destination Fees + Entry Fee + Import Deposit
        </p>
      </div>

      <Tabs defaultValue="freight">
        <TabsList className="h-8">
          <TabsTrigger value="freight" className="text-xs h-7 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />Freight &amp; Import Fees
          </TabsTrigger>
          <TabsTrigger value="hts" className="text-xs h-7 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />HTS Tariff Rates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="freight" className="mt-4">
          <FreightConfigTab />
        </TabsContent>
        <TabsContent value="hts" className="mt-4">
          <HtsCodesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
