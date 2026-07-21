/**
 * Buy Side — all buy-side inputs only.
 * Contains: Pricing Config, Tariff Scenario, Global Margins, Tier Discounts,
 *           Margin Overrides (category/vendor/SKU), and Section Locks.
 * Customer management has moved to Dealers.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { HelpCircle, Loader2, Lock, Settings, Unlock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

function fmtPct(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return `${(parseFloat(String(val)) * 100).toFixed(1)}%`;
}

// ─── Pricing Rules Tab ────────────────────────────────────────────────────────

function PricingRulesTab() {
  const { data, isLoading, refetch } = trpc.dealerPricing.getAssumptions.useQuery();
  const updateMargin = trpc.dealerPricing.updateMarginRule.useMutation({ onSuccess: () => refetch() });
  const deleteMargin = trpc.dealerPricing.deleteMarginRule.useMutation({ onSuccess: () => refetch() });
  const updateTier = trpc.dealerPricing.updateTierDiscount.useMutation({ onSuccess: () => refetch() });
  const updateConfig = trpc.dealerPricing.updateConfig.useMutation({ onSuccess: () => refetch() });

  const [editingMargin, setEditingMargin] = useState<{
    id?: number; scope: string; scopeValue: string; importPct: string; domesticPct: string; notes: string;
  } | null>(null);
  const [editingTier, setEditingTier] = useState<{ tier: number; pct: string } | null>(null);

  if (isLoading) return (
    <div className="flex items-center gap-2 py-8 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing rules…
    </div>
  );

  const globalRule = data?.marginRules.find((r) => r.scope === "global");
  const overrideRules = data?.marginRules.filter((r) => r.scope !== "global") ?? [];
  const configMap: Record<string, string> = {};
  for (const c of data?.config ?? []) {
    if (c.key && c.value) configMap[c.key] = c.value;
  }

  return (
    <div className="space-y-6">
      {/* Pricing Formula */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong>Pricing formula:</strong>{" "}
          <code className="bg-background px-1 rounded">List Price = Landed Cost ÷ (1 − Margin% − Royalty%)</code>
          {" · "}
          <code className="bg-background px-1 rounded">Net Price = List × (1 − Tier Discount%)</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Royalty is embedded in the denominator for B&amp;D SKUs, so the list price already covers it. The margin shown is the gross margin after royalty is priced in.
        </p>
      </div>

      {/* Cost Basis & Tariff Scenario */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Cost Basis
                <InfoTip text="Determines which cost figure is used as the starting point for list price calculations. 'Landed Cost' is the standard choice (FOB + tariffs + freight). 'Factory Cost' adds B&D fees on top." />
              </Label>
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
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Price Rounding
                <InfoTip text="How to round the final net price. 'None' leaves the raw decimal. All other options round to the nearest increment." />
              </Label>
              <Select
                value={configMap["price_rounding"] ?? "none"}
                onValueChange={(v) => updateConfig.mutate({ key: "price_rounding", value: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (raw decimal)</SelectItem>
                  <SelectItem value="cent">Nearest cent ($0.01)</SelectItem>
                  <SelectItem value="nickel">Nearest nickel ($0.05)</SelectItem>
                  <SelectItem value="dime">Nearest dime ($0.10)</SelectItem>
                  <SelectItem value="dollar">Nearest dollar ($1.00)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Tariff Scenario
              <InfoTip text="Controls which tariff rates are applied in the landed cost engine. 'Current Law' keeps Section 122 active. '2027 Base' removes it. 'Stress' also raises Section 301 to 35%." />
            </Label>
            <Select
              value={configMap["tariff_scenario"] ?? "current_law"}
              onValueChange={(v) => updateConfig.mutate({ key: "tariff_scenario", value: v })}
            >
              <SelectTrigger className="mt-1 max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_law">Current Law — Section 122 active (indefinite)</SelectItem>
                <SelectItem value="base_2027">2027 Base — Section 122 expires</SelectItem>
                <SelectItem value="stress">Stress — Sec 122 expires + 301 → 35%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Global Margins */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Global Margins
              <InfoTip text="The default margin applied to all SKUs unless overridden by a category, vendor, or SKU-level rule below. Import margin is used for overseas-sourced products; domestic margin for US-sourced." />
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingMargin({
                id: globalRule?.id,
                scope: "global",
                scopeValue: "",
                importPct: globalRule?.importMarginPct ? (parseFloat(globalRule.importMarginPct) * 100).toFixed(1) : "",
                domesticPct: globalRule?.domesticMarginPct ? (parseFloat(globalRule.domesticMarginPct) * 100).toFixed(1) : "",
                notes: globalRule?.notes ?? "",
              })}
            >
              {globalRule ? "Edit" : "Set Margins"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className={`text-2xl font-bold ${globalRule?.importMarginPct ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                {globalRule?.importMarginPct ? fmtPct(globalRule.importMarginPct) : "Not set"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Import Margin
                <InfoTip text="Target gross margin for import-track SKUs (products shipped from overseas). Formula: (List − Landed Cost) ÷ List." />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className={`text-2xl font-bold ${globalRule?.domesticMarginPct ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"}`}>
                {globalRule?.domesticMarginPct ? fmtPct(globalRule.domesticMarginPct) : "Not set"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Domestic Margin
                <InfoTip text="Target gross margin for domestic-track SKUs (products sourced within the US or with lower freight costs)." />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier Discounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tier Discounts
            <InfoTip text="Each dealer is assigned a tier (Level 1, 2, or 3). The tier discount is applied to the list price to arrive at the dealer's net price. Level 1 gets the best (highest) discount." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((tier) => {
              const t = (data?.tiers ?? []).find((x) => x.tier === tier);
              return (
                <div
                  key={tier}
                  className="rounded-lg border p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setEditingTier({ tier, pct: t ? (parseFloat(t.discountPct) * 100).toFixed(1) : "" })}
                >
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Level {tier}</div>
                  <div className={`text-2xl font-bold ${t ? "" : "text-muted-foreground"}`}>
                    {t ? fmtPct(t.discountPct) : "Not set"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{t ? "off list price" : "click to set"}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category / Vendor / SKU Overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Margin Overrides
              <InfoTip text="Override the global margin for a specific product category, vendor, or individual SKU. The most specific rule wins: SKU > Vendor > Category > Global." />
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingMargin({ scope: "category", scopeValue: "", importPct: "", domesticPct: "", notes: "" })}
            >
              + Add Override
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overrideRules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No overrides yet. Global margins apply to all SKUs.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Scope
                    <InfoTip text="Whether this override applies to a product category, a vendor, or a specific SKU." />
                  </TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">
                    Import %
                    <InfoTip text="Override import margin for this scope. Leave blank to inherit global." />
                  </TableHead>
                  <TableHead className="text-right">
                    Domestic %
                    <InfoTip text="Override domestic margin for this scope. Leave blank to inherit global." />
                  </TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrideRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize text-sm">{r.scope}</TableCell>
                    <TableCell className="text-sm font-mono">{r.scopeValue ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{r.importMarginPct ? fmtPct(r.importMarginPct) : "—"}</TableCell>
                    <TableCell className="text-right text-sm">{r.domesticMarginPct ? fmtPct(r.domesticMarginPct) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingMargin({
                          id: r.id,
                          scope: r.scope,
                          scopeValue: r.scopeValue ?? "",
                          importPct: r.importMarginPct ? (parseFloat(r.importMarginPct) * 100).toFixed(1) : "",
                          domesticPct: r.domesticMarginPct ? (parseFloat(r.domesticMarginPct) * 100).toFixed(1) : "",
                          notes: r.notes ?? "",
                        })}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => deleteMargin.mutate({ id: r.id })}
                      >
                        Delete
                      </Button>
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
          <DialogHeader>
            <DialogTitle>{editingMargin?.id ? "Edit Margin Rule" : "Add Margin Override"}</DialogTitle>
          </DialogHeader>
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
                    <Input
                      className="mt-1"
                      value={editingMargin.scopeValue}
                      onChange={(e) => setEditingMargin({ ...editingMargin, scopeValue: e.target.value })}
                      placeholder="e.g. Pool Cleaners"
                    />
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Import Margin %</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.1"
                    value={editingMargin.importPct}
                    onChange={(e) => setEditingMargin({ ...editingMargin, importPct: e.target.value })}
                    placeholder="e.g. 20.0"
                  />
                </div>
                <div>
                  <Label>Domestic Margin %</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.1"
                    value={editingMargin.domesticPct}
                    onChange={(e) => setEditingMargin({ ...editingMargin, domesticPct: e.target.value })}
                    placeholder="e.g. 35.0"
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  className="mt-1"
                  value={editingMargin.notes}
                  onChange={(e) => setEditingMargin({ ...editingMargin, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingMargin(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    updateMargin.mutate({
                      id: editingMargin.id,
                      scope: editingMargin.scope as "global" | "category" | "vendor" | "sku",
                      scopeValue: editingMargin.scopeValue || null,
                      importMarginPct: editingMargin.importPct ? parseFloat(editingMargin.importPct) / 100 : null,
                      domesticMarginPct: editingMargin.domesticPct ? parseFloat(editingMargin.domesticPct) / 100 : null,
                      notes: editingMargin.notes || null,
                    });
                    setEditingMargin(null);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Tier Dialog */}
      <Dialog open={!!editingTier} onOpenChange={(o) => !o && setEditingTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Level {editingTier?.tier} Discount</DialogTitle>
          </DialogHeader>
          {editingTier && (
            <div className="space-y-4">
              <div>
                <Label>Discount % off list price</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.1"
                  value={editingTier.pct}
                  onChange={(e) => setEditingTier({ ...editingTier, pct: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingTier(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    updateTier.mutate({ tier: editingTier.tier, discountPct: parseFloat(editingTier.pct) / 100 });
                    setEditingTier(null);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Locks Tab ────────────────────────────────────────────────────────────────

function LocksTab() {
  const utils = trpc.useUtils();
  const { data: locks } = trpc.dealerPricing.getLocks.useQuery();
  const lockMut = trpc.dealerPricing.lock.useMutation({
    onSuccess: () => utils.dealerPricing.getLocks.invalidate(),
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const unlockMut = trpc.dealerPricing.unlock.useMutation({
    onSuccess: () => utils.dealerPricing.getLocks.invalidate(),
    onError: (e: { message: string }) => toast.error(e.message),
  });

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
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-muted-foreground">
        Lock a section to prevent accidental edits to cost inputs or pricing rules. Each section has its own password.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {[
          { scope: "supply" as const, label: "Supply Side", desc: "Freight rates, tariff rates, HTS codes, FOB prices", lock: supplyLock },
          { scope: "buy" as const, label: "Buy Side", desc: "Tier discounts, margin rules, pricing configuration", lock: buyLock },
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => { setLockDialog({ scope, action: "unlock" }); setPassword(""); }}
                  >
                    <Unlock className="h-3 w-3 mr-1" /> Unlock
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => { setLockDialog({ scope, action: "lock" }); setPassword(""); }}
                  >
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
              <Input
                className="mt-1"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLockDialog(null)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!password || lockMut.isPending || unlockMut.isPending}
              >
                {lockMut.isPending || unlockMut.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : lockDialog?.action === "lock" ? "Lock" : "Unlock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuySide() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Buy Side</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          All pricing rules that determine what dealers pay. Set global margins, tier discounts, and category/vendor overrides here. These rules are applied on top of the landed costs from Supply Side.
        </p>
      </div>

      <Tabs defaultValue="rules">
        <TabsList className="h-8">
          <TabsTrigger value="rules" className="text-xs h-7 flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />Pricing Rules
          </TabsTrigger>
          <TabsTrigger value="locks" className="text-xs h-7 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />Section Locks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <PricingRulesTab />
        </TabsContent>
        <TabsContent value="locks" className="mt-4">
          <LocksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
