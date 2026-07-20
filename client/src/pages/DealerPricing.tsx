import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Unlock, Settings, Users, DollarSign, AlertTriangle, Download, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return `$${val.toFixed(decimals)}`;
}

function fmtPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

function marginColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "text-muted-foreground";
  if (pct >= 0.3) return "text-green-600 dark:text-green-400";
  if (pct >= 0.2) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function fob2027Badge(status: string | null) {
  if (status === "confirmed") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">Confirmed</Badge>;
  if (status === "placeholder") return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">Placeholder</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">No FOB</Badge>;
}

// ─── Assumptions Tab ──────────────────────────────────────────────────────────

function AssumptionsTab() {
  const { data, isLoading, refetch } = trpc.dealerPricing.getAssumptions.useQuery();
  const updateMargin = trpc.dealerPricing.updateMarginRule.useMutation({ onSuccess: () => refetch() });
  const deleteMargin = trpc.dealerPricing.deleteMarginRule.useMutation({ onSuccess: () => refetch() });
  const updateTier = trpc.dealerPricing.updateTierDiscount.useMutation({ onSuccess: () => refetch() });
  const updateConfig = trpc.dealerPricing.updateConfig.useMutation({ onSuccess: () => refetch() });

  const [editingMargin, setEditingMargin] = useState<{ id?: number; scope: string; scopeValue: string; importPct: string; domesticPct: string; notes: string } | null>(null);
  const [editingTier, setEditingTier] = useState<{ tier: number; pct: string } | null>(null);

  if (isLoading) return <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading assumptions...</div>;

  const globalRule = data?.marginRules.find((r) => r.scope === "global");
  const overrideRules = data?.marginRules.filter((r) => r.scope !== "global") ?? [];
  const configMap: Record<string, string> = {};
  for (const c of data?.config ?? []) {
    if (c.key && c.value) configMap[c.key] = c.value;
  }

  const isSetUp = !!globalRule && (data?.tiers?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Setup guidance — shown when nothing is configured yet */}
      {!isSetUp && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950 p-4">
          <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Setup required.</strong> Set your global import and domestic margins below, then add tier discounts for L1, L2, and L3. The matrix will calculate list and net prices once these are in place.
          </div>
        </div>
      )}

      {/* Pricing Config */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cost Basis</Label>
              <Select
                value={configMap["pricing_basis"] ?? "landed_cost"}
                onValueChange={(v) => updateConfig.mutate({ key: "pricing_basis", value: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landed_cost">Landed Cost (FOB + tariff + freight)</SelectItem>
                  <SelectItem value="factory_cost">Factory Cost (Landed + BD Fees)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Pricing Mode</Label>
              <Select
                value={configMap["pricing_mode"] ?? "1"}
                onValueChange={(v) => updateConfig.mutate({ key: "pricing_mode", value: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Mode 1 — Discount off list</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Formula: <code className="bg-muted px-1 rounded">list = cost ÷ (1 − margin% − royalty%)</code> &nbsp;·&nbsp; <code className="bg-muted px-1 rounded">net = list × (1 − discount%)</code>
          </p>
        </CardContent>
      </Card>

      {/* Global Margins */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Global Margins</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setEditingMargin({ id: globalRule?.id, scope: "global", scopeValue: "", importPct: globalRule?.importMarginPct ? (parseFloat(globalRule.importMarginPct) * 100).toFixed(1) : "", domesticPct: globalRule?.domesticMarginPct ? (parseFloat(globalRule.domesticMarginPct) * 100).toFixed(1) : "", notes: globalRule?.notes ?? "" })}>
              {globalRule ? "Edit" : "Set Margins"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className={`text-2xl font-bold ${globalRule?.importMarginPct ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                {globalRule?.importMarginPct ? fmtPct(parseFloat(globalRule.importMarginPct)) : "Not set"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Import Margin</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className={`text-2xl font-bold ${globalRule?.domesticMarginPct ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                {globalRule?.domesticMarginPct ? fmtPct(parseFloat(globalRule.domesticMarginPct)) : "Not set"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Domestic Margin</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier Discounts */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tier Discounts (Discount off List)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((tier) => {
              const t = (data?.tiers ?? []).find((x) => x.tier === tier);
              return (
                <div key={tier} className="rounded-lg border p-4 text-center cursor-pointer hover:border-primary transition-colors" onClick={() => setEditingTier({ tier, pct: t ? (parseFloat(t.discountPct) * 100).toFixed(1) : "" })}>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Level {tier}</div>
                  <div className={`text-2xl font-bold ${t ? '' : 'text-muted-foreground'}`}>
                    {t ? fmtPct(parseFloat(t.discountPct)) : "Not set"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{t ? "off list" : "click to set"}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category / Vendor Overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Margin Overrides (Category / Vendor / SKU)</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setEditingMargin({ scope: "category", scopeValue: "", importPct: "", domesticPct: "", notes: "" })}>
              + Add Override
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overrideRules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No overrides yet. Global margins apply to all SKUs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Import %</TableHead>
                  <TableHead className="text-right">Domestic %</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrideRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize text-sm">{r.scope}</TableCell>
                    <TableCell className="text-sm font-mono">{r.scopeValue ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{r.importMarginPct ? fmtPct(parseFloat(r.importMarginPct)) : "—"}</TableCell>
                    <TableCell className="text-right text-sm">{r.domesticMarginPct ? fmtPct(parseFloat(r.domesticMarginPct)) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setEditingMargin({ id: r.id, scope: r.scope, scopeValue: r.scopeValue ?? "", importPct: r.importMarginPct ? (parseFloat(r.importMarginPct) * 100).toFixed(1) : "", domesticPct: r.domesticMarginPct ? (parseFloat(r.domesticMarginPct) * 100).toFixed(1) : "", notes: r.notes ?? "" })}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteMargin.mutate({ id: r.id })}>Del</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Margin Dialog */}
      <Dialog open={!!editingMargin} onOpenChange={(o) => !o && setEditingMargin(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMargin?.id ? "Edit Margin Rule" : "Add Margin Override"}</DialogTitle></DialogHeader>
          {editingMargin && (
            <div className="space-y-4">
              {editingMargin.scope !== "global" && (
                <>
                  <div>
                    <Label>Scope</Label>
                    <Select value={editingMargin.scope} onValueChange={(v) => setEditingMargin({ ...editingMargin, scope: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="sku">SKU</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value (category name, vendor name, or SKU code)</Label>
                    <Input className="mt-1" value={editingMargin.scopeValue} onChange={(e) => setEditingMargin({ ...editingMargin, scopeValue: e.target.value })} placeholder="e.g. Pool Cleaners" />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Import Margin %</Label>
                  <Input className="mt-1" type="number" step="0.1" value={editingMargin.importPct} onChange={(e) => setEditingMargin({ ...editingMargin, importPct: e.target.value })} placeholder="e.g. 20.0" />
                </div>
                <div>
                  <Label>Domestic Margin %</Label>
                  <Input className="mt-1" type="number" step="0.1" value={editingMargin.domesticPct} onChange={(e) => setEditingMargin({ ...editingMargin, domesticPct: e.target.value })} placeholder="e.g. 35.0" />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input className="mt-1" value={editingMargin.notes} onChange={(e) => setEditingMargin({ ...editingMargin, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingMargin(null)}>Cancel</Button>
                <Button onClick={() => {
                  updateMargin.mutate({
                    id: editingMargin.id,
                    scope: editingMargin.scope as "global" | "category" | "vendor" | "sku",
                    scopeValue: editingMargin.scopeValue || null,
                    importMarginPct: editingMargin.importPct ? parseFloat(editingMargin.importPct) / 100 : null,
                    domesticMarginPct: editingMargin.domesticPct ? parseFloat(editingMargin.domesticPct) / 100 : null,
                    notes: editingMargin.notes || null,
                  });
                  setEditingMargin(null);
                }}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Tier Dialog */}
      <Dialog open={!!editingTier} onOpenChange={(o) => !o && setEditingTier(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Level {editingTier?.tier} Discount</DialogTitle></DialogHeader>
          {editingTier && (
            <div className="space-y-4">
              <div>
                <Label>Discount % off list</Label>
                <Input className="mt-1" type="number" step="0.1" value={editingTier.pct} onChange={(e) => setEditingTier({ ...editingTier, pct: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingTier(null)}>Cancel</Button>
                <Button onClick={() => {
                  updateTier.mutate({ tier: editingTier.tier, discountPct: parseFloat(editingTier.pct) / 100 });
                  setEditingTier(null);
                }}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab() {
  const { data: customers, isLoading, refetch } = trpc.dealerPricing.getCustomers.useQuery();
  const upsert = trpc.dealerPricing.upsertCustomer.useMutation({ onSuccess: () => refetch() });
  const importCustomers = trpc.dealerPricing.importCustomers.useMutation({
    onSuccess: (r) => {
      toast.success(`Imported ${r.inserted} customers${r.skipped > 0 ? `, skipped ${r.skipped} duplicates` : ""}`);
      refetch();
      setCsvDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const [editing, setEditing] = useState<{ id?: number; name: string; tier: number; notes: string } | null>(null);
  const [search, setSearch] = useState("");
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvMode, setCsvMode] = useState<"append" | "replace">("append");
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; tier: number; sales2025_26: number | null }>>([]);

  function parseCsv(text: string) {
    const lines = text.trim().split("\n").filter(Boolean);
    const parsed: Array<{ name: string; tier: number; sales2025_26: number | null }> = [];
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 2) continue;
      const name = cols[0];
      const tier = parseInt(cols[1], 10);
      if (!name || isNaN(tier) || tier < 1 || tier > 3) continue;
      const sales = cols[2] ? parseFloat(cols[2].replace(/[^0-9.]/g, "")) : null;
      parsed.push({ name, tier, sales2025_26: isNaN(sales ?? NaN) ? null : sales });
    }
    return parsed;
  }

  const filtered = useMemo(() => {
    if (!customers) return [];
    if (!search) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [customers, search]);

  const tierCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const c of customers ?? []) counts[c.tier] = (counts[c.tier] ?? 0) + 1;
    return counts;
  }, [customers]);

  if (isLoading) return <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading customers...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((tier) => (
          <div key={tier} className="rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">{tierCounts[tier] ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Level {tier} Dealers</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button size="sm" variant="outline" onClick={() => setEditing({ name: "", tier: 3, notes: "" })}>+ Add Customer</Button>
        <Button size="sm" variant="outline" onClick={() => { setCsvText(""); setCsvPreview([]); setCsvDialogOpen(true); }}>
          <Upload className="h-3.5 w-3.5 mr-1" />Import CSV
        </Button>
      </div>

      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import Customers from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground">
              <strong>Format:</strong> One customer per line: <code>Name, Tier (1-3), 2025-26 Sales (optional)</code><br />
              Example: <code>Island Recreational, 1, 485000</code>
            </div>
            <div>
              <Label>Paste CSV data</Label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[160px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={"Island Recreational, 1, 485000\nQualco, 1, 320000\nHansens, 3, 45000"}
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setCsvPreview(parseCsv(e.target.value)); }}
              />
            </div>
            {csvPreview.length > 0 && (
              <div className="rounded-lg border overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead><tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Tier</th>
                    <th className="text-right px-3 py-2">2025-26 Sales</th>
                  </tr></thead>
                  <tbody>
                    {csvPreview.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">L{r.tier}</td>
                        <td className="px-3 py-1.5 text-right">{r.sales2025_26 ? `$${r.sales2025_26.toLocaleString()}` : "—"}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 20 && <tr><td colSpan={3} className="px-3 py-1.5 text-muted-foreground text-center">+{csvPreview.length - 20} more rows</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Label className="text-sm">Import mode:</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="csvMode" value="append" checked={csvMode === "append"} onChange={() => setCsvMode("append")} />
                  Append (skip duplicates)
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="csvMode" value="replace" checked={csvMode === "replace"} onChange={() => setCsvMode("replace")} />
                  <span className="text-destructive font-medium">Replace all</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={csvPreview.length === 0 || importCustomers.isPending}
                onClick={() => importCustomers.mutate({ rows: csvPreview, mode: csvMode })}
              >
                {importCustomers.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Import {csvPreview.length} Customers
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">2025–26 Sales</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm">{c.name}</TableCell>
                <TableCell>
                  <Badge variant={c.tier === 1 ? "default" : "outline"} className="text-xs">
                    L{c.tier}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {c.sales2025_26 ? `$${parseFloat(c.sales2025_26).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                </TableCell>
                <TableCell>
                  {c.active ? <Badge variant="outline" className="text-xs text-green-600">Active</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name, tier: c.tier, notes: c.notes ?? "" })}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Customer Name</Label>
                <Input className="mt-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Tier</Label>
                <Select value={String(editing.tier)} onValueChange={(v) => setEditing({ ...editing, tier: parseInt(v) })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 (Top tier)</SelectItem>
                    <SelectItem value="2">Level 2 (Mid tier)</SelectItem>
                    <SelectItem value="3">Level 3 (Standard)</SelectItem>
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

// ─── Buy Side Matrix Tab ──────────────────────────────────────────────────────

function BuySideMatrix() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [fobFilter, setFobFilter] = useState("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"import" | "domestic" | "both">("both");

  const { data: customers } = trpc.dealerPricing.getCustomers.useQuery({ activeOnly: true });

  const { data, isLoading, isFetching } = trpc.dealerPricing.getBuySideMatrix.useQuery({
    page,
    pageSize: 50,
    search: search || undefined,
    category: category !== "all" ? category : undefined,
    brand: brand !== "all" ? brand : undefined,
    fob2027StatusFilter: fobFilter !== "all" ? fobFilter : undefined,
    customerId: selectedCustomerId,
  });

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  // For the matrix, show only the selected customer or all customers in compact mode
  const displayCustomers = selectedCustomerId
    ? (data?.customers ?? []).filter((c) => c.id === selectedCustomerId)
    : (data?.customers ?? []).slice(0, 5); // show first 5 in overview mode

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search SKU or description..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-64"
          />
          <Button size="sm" onClick={handleSearch}>Search</Button>
        </div>
        <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Brand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            <SelectItem value="BD">BD</SelectItem>
            <SelectItem value="Sunnora">Sunnora</SelectItem>
            <SelectItem value="Blue Torrent">Blue Torrent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fobFilter} onValueChange={(v) => { setFobFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="FOB 2027 Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All FOB Status</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="placeholder">Placeholder</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCustomerId ? String(selectedCustomerId) : "all"} onValueChange={(v) => setSelectedCustomerId(v !== "all" ? parseInt(v) : undefined)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Filter by customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers (overview)</SelectItem>
            {(customers ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name} (L{c.tier})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as "import" | "domestic" | "both")}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="both">Import + Domestic</SelectItem>
            <SelectItem value="import">Import Only</SelectItem>
            <SelectItem value="domestic">Domestic Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="text-sm text-muted-foreground">
          Showing {data.rows.length} of {data.total.toLocaleString()} SKUs
          {fobFilter === "placeholder" && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400">⚠ Placeholder costs — prices are estimates</span>
          )}
        </div>
      )}

      {/* Matrix Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">SKU</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>2027 FOB Status</TableHead>
              <TableHead className="text-right">Cost Basis</TableHead>
              <TableHead className="text-right" title="Cost-vs-cost: 2027 landed cost vs 2026 avg FOB cost. Per Dan: tariff is a separate line item so compare cost to cost.">vs 2026 Cost</TableHead>
              {!selectedCustomerId ? (
                // Overview: show list prices + L1/L2/L3 net
                <>
                  {(viewMode === "import" || viewMode === "both") && <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30">Import List</TableHead>}
                  {(viewMode === "domestic" || viewMode === "both") && <TableHead className="text-right bg-purple-50 dark:bg-purple-950/30">Domestic List</TableHead>}
                  {(viewMode === "import" || viewMode === "both") && <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30">Import Net — Tier 1</TableHead>}
                  {(viewMode === "import" || viewMode === "both") && <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30">Import Net — Tier 2</TableHead>}
                  {(viewMode === "import" || viewMode === "both") && <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30">Import Net — Tier 3</TableHead>}
                  {(viewMode === "domestic" || viewMode === "both") && <TableHead className="text-right bg-purple-50 dark:bg-purple-950/30">Domestic Net — Tier 1</TableHead>}
                  {(viewMode === "domestic" || viewMode === "both") && <TableHead className="text-right bg-purple-50 dark:bg-purple-950/30">Domestic Net — Tier 2</TableHead>}
                  {(viewMode === "domestic" || viewMode === "both") && <TableHead className="text-right bg-purple-50 dark:bg-purple-950/30">Domestic Net — Tier 3</TableHead>}
                </>
              ) : (
                // Single customer view
                <>
                  {(viewMode === "import" || viewMode === "both") && <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30">Import List</TableHead>}
                  {(viewMode === "import" || viewMode === "both") && <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30">Import Net</TableHead>}
                  {(viewMode === "import" || viewMode === "both") && <TableHead className="text-right bg-blue-50 dark:bg-blue-950/30">Import Margin</TableHead>}
                  {(viewMode === "domestic" || viewMode === "both") && <TableHead className="text-right bg-purple-50 dark:bg-purple-950/30">Domestic List</TableHead>}
                  {(viewMode === "domestic" || viewMode === "both") && <TableHead className="text-right bg-purple-50 dark:bg-purple-950/30">Domestic Net</TableHead>}
                  {(viewMode === "domestic" || viewMode === "both") && <TableHead className="text-right bg-purple-50 dark:bg-purple-950/30">Domestic Margin</TableHead>}
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || isFetching ? (
              <TableRow>
                <TableCell colSpan={20} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading...
                </TableCell>
              </TableRow>
            ) : (data?.rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={20} className="text-center py-8 text-muted-foreground">No SKUs found</TableCell>
              </TableRow>
            ) : (
              (data?.rows ?? []).map((row) => {
                // Build tier net price lookup from customerPrices
                const byTier: Record<number, { importNet: number | null; domesticNet: number | null; importList: number | null; domesticList: number | null; keptMarginImport: number | null; keptMarginDomestic: number | null }> = {};
                for (const cp of row.customerPrices) {
                  if (!byTier[cp.tier] || cp.customerId === selectedCustomerId) {
                    byTier[cp.tier] = { importNet: cp.importNet, domesticNet: cp.domesticNet, importList: cp.importList, domesticList: cp.domesticList, keptMarginImport: cp.keptMarginImport, keptMarginDomestic: cp.keptMarginDomestic };
                  }
                }
                const selCp = selectedCustomerId ? row.customerPrices.find((cp) => cp.customerId === selectedCustomerId) : null;

                return (
                  <TableRow key={row.skuId} className={`hover:bg-muted/30 ${'isBlocked' in row && row.isBlocked ? 'opacity-60 bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                    <TableCell className="sticky left-0 bg-background z-10 font-mono text-xs font-medium">
                      <div className="flex items-center gap-1">
                        {row.sku}
                        {'isBlocked' in row && row.isBlocked && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">BLOCKED</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{row.description}</TableCell>
                    <TableCell className="text-xs">{row.productGroup ?? "—"}</TableCell>
                    <TableCell>{fob2027Badge(row.fob2027Status)}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmt(row.costBasis)}</TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {'costDelta' in row && row.costDelta !== null && row.costDelta !== undefined ? (
                        <span className={row.costDelta > 0 ? 'text-red-600 dark:text-red-400' : row.costDelta < 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {row.costDelta > 0 ? '+' : ''}{(row.costDelta * 100).toFixed(1)}%
                        </span>
                      ) : '—'}
                    </TableCell>
                    {!selectedCustomerId ? (
                      <>
                        {(viewMode === "import" || viewMode === "both") && <TableCell className="text-right text-sm font-mono bg-blue-50/50 dark:bg-blue-950/20">{fmt(row.importList)}</TableCell>}
                        {(viewMode === "domestic" || viewMode === "both") && <TableCell className="text-right text-sm font-mono bg-purple-50/50 dark:bg-purple-950/20">{fmt(row.domesticList)}</TableCell>}
                        {(viewMode === "import" || viewMode === "both") && [1, 2, 3].map((tier) => (
                          <TableCell key={`imp-${tier}`} className="text-right text-sm font-mono bg-blue-50/50 dark:bg-blue-950/20">{fmt(byTier[tier]?.importNet)}</TableCell>
                        ))}
                        {(viewMode === "domestic" || viewMode === "both") && [1, 2, 3].map((tier) => (
                          <TableCell key={`dom-${tier}`} className="text-right text-sm font-mono bg-purple-50/50 dark:bg-purple-950/20">{fmt(byTier[tier]?.domesticNet)}</TableCell>
                        ))}
                      </>
                    ) : (
                      <>
                        {(viewMode === "import" || viewMode === "both") && <>
                          <TableCell className="text-right text-sm font-mono bg-blue-50/50 dark:bg-blue-950/20">{fmt(selCp?.importList)}</TableCell>
                          <TableCell className="text-right text-sm font-mono bg-blue-50/50 dark:bg-blue-950/20">{fmt(selCp?.importNet)}</TableCell>
                          <TableCell className={`text-right text-sm font-mono bg-blue-50/50 dark:bg-blue-950/20 ${marginColor(selCp?.keptMarginImport)}`}>{fmtPct(selCp?.keptMarginImport)}</TableCell>
                        </>}
                        {(viewMode === "domestic" || viewMode === "both") && <>
                          <TableCell className="text-right text-sm font-mono bg-purple-50/50 dark:bg-purple-950/20">{fmt(selCp?.domesticList)}</TableCell>
                          <TableCell className="text-right text-sm font-mono bg-purple-50/50 dark:bg-purple-950/20">{fmt(selCp?.domesticNet)}</TableCell>
                          <TableCell className={`text-right text-sm font-mono bg-purple-50/50 dark:bg-purple-950/20 ${marginColor(selCp?.keptMarginDomestic)}`}>{fmtPct(selCp?.keptMarginDomestic)}</TableCell>
                        </>}
                      </>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Locks Panel ──────────────────────────────────────────────────────────────

function LocksPanel() {
  const { data: locks, refetch } = trpc.dealerPricing.getLocks.useQuery();
  const lockMut = trpc.dealerPricing.lock.useMutation({ onSuccess: () => refetch() });
  const unlockMut = trpc.dealerPricing.unlock.useMutation({ onSuccess: () => refetch() });

  const [lockDialog, setLockDialog] = useState<{ scope: "supply" | "buy"; action: "lock" | "unlock" } | null>(null);
  const [password, setPassword] = useState("");

  const supplyLock = locks?.find((l) => l.scope === "supply");
  const buyLock = locks?.find((l) => l.scope === "buy");

  const handleSubmit = async () => {
    if (!lockDialog) return;
    if (lockDialog.action === "lock") {
      const res = await lockMut.mutateAsync({ scope: lockDialog.scope, password });
      if (res.success) toast.success(`${lockDialog.scope === "supply" ? "Supply" : "Buy"} side locked`);
    } else {
      const res = await unlockMut.mutateAsync({ scope: lockDialog.scope, password });
      if (res.success) toast.success("Unlocked");
      else toast.error("Incorrect password");
    }
    setLockDialog(null);
    setPassword("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Lock sections to prevent accidental edits. Each section has its own password.</p>
      <div className="grid grid-cols-2 gap-4">
        {[
          { scope: "supply" as const, label: "Supply Side", desc: "Cost inputs, margins, FOB prices", lock: supplyLock },
          { scope: "buy" as const, label: "Buy Side", desc: "Tier discounts, customer assignments, net prices", lock: buyLock },
        ].map(({ scope, label, desc, lock }) => (
          <Card key={scope}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                </div>
                {lock?.locked ? (
                  <Lock className="h-5 w-5 text-red-500" />
                ) : (
                  <Unlock className="h-5 w-5 text-green-500" />
                )}
              </div>
              <div className="mt-4">
                {lock?.locked ? (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { setLockDialog({ scope, action: "unlock" }); setPassword(""); }}>
                    <Unlock className="h-3 w-3 mr-1" /> Unlock
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => { setLockDialog({ scope, action: "lock" }); setPassword(""); }}>
                    <Lock className="h-3 w-3 mr-1" /> Lock
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!lockDialog} onOpenChange={(o) => !o && setLockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lockDialog?.action === "lock" ? "Set Lock Password" : "Enter Password to Unlock"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Password</Label>
              <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} autoFocus />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLockDialog(null)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!password || lockMut.isPending || unlockMut.isPending}>
                {lockMut.isPending || unlockMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : lockDialog?.action === "lock" ? "Lock" : "Unlock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DealerPricing() {
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">2027 Dealer Pricing</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Import and domestic net prices by customer tier — based on Dan's 2027 pricing model
            </p>
          </div>
        </div>

        <Tabs defaultValue="matrix">
          <TabsList>
            <TabsTrigger value="matrix"><DollarSign className="h-4 w-4 mr-1" />Buy Side Matrix</TabsTrigger>
            <TabsTrigger value="assumptions"><Settings className="h-4 w-4 mr-1" />Assumptions</TabsTrigger>
            <TabsTrigger value="customers"><Users className="h-4 w-4 mr-1" />Customers</TabsTrigger>
            <TabsTrigger value="locks"><Lock className="h-4 w-4 mr-1" />Locks</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix" className="mt-4">
            <BuySideMatrix />
          </TabsContent>

          <TabsContent value="assumptions" className="mt-4">
            <AssumptionsTab />
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="locks" className="mt-4">
            <LocksPanel />
          </TabsContent>
        </Tabs>
    </div>
  );
}
