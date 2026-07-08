import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import EditSKUDialog from "@/components/EditSKUDialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Box,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Edit2,
  Loader2,
  Package,
  Pencil,
  Tag,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val: string | number | null | undefined, prefix = "$"): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function marginColor(pctVal: string | number | null | undefined): string {
  const n = Number(pctVal ?? 0);
  if (n >= 0.35) return "text-emerald-600";
  if (n >= 0.25) return "text-yellow-600";
  if (n >= 0.15) return "text-orange-500";
  return "text-red-500";
}

function Row({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b last:border-0 ${className}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%]">{value ?? "—"}</span>
    </div>
  );
}

type ChannelPriceForm = {
  price: string;
  floorPrice: string;
  ceilingPrice: string;
  targetMarginPct: string;
  competitorPrice: string;
  notes: string;
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SKUDetail({ skuId }: { skuId: number }) {
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyChannelId, setHistoryChannelId] = useState<number | undefined>(undefined);
  const [cpForm, setCpForm] = useState<ChannelPriceForm>({ price: "", floorPrice: "", ceilingPrice: "", targetMarginPct: "", competitorPrice: "", notes: "" });
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.skus.get.useQuery({ id: skuId });
  const { data: cartonDetails, isLoading: cartonLoading } = trpc.skus.cartonDetails.useQuery({ skuId });
  const { data: channelPrices, isLoading: channelLoading } = trpc.channelPrices.bySku.useQuery({ skuId });
  const { data: channels } = trpc.channels.list.useQuery();
  const { data: priceHistory, isLoading: historyLoading } = trpc.channelPrices.priceHistory.useQuery(
    { skuId, channelId: historyChannelId, limit: 100 },
    { enabled: showHistory }
  );

  const upsertChannelPrice = trpc.channelPrices.upsert.useMutation({
    onSuccess: () => {
      toast.success("Channel price updated");
      setEditingChannelId(null);
      utils.channelPrices.bySku.invalidate({ skuId });
    },
    onError: (e) => toast.error(e.message),
  });

  function openCpEdit(channelId: number) {
    const existing = (channelPrices ?? []).find(cp => cp.channelId === channelId);
    setCpForm({
      price: existing?.price ?? "",
      floorPrice: existing?.floorPrice ?? "",
      ceilingPrice: existing?.ceilingPrice ?? "",
      targetMarginPct: existing?.targetMarginPct ? String(Number(existing.targetMarginPct) * 100) : "",
      competitorPrice: existing?.competitorPrice ?? "",
      notes: existing?.notes ?? "",
    });
    setEditingChannelId(channelId);
  }

  function saveCpEdit() {
    if (editingChannelId === null) return;
    upsertChannelPrice.mutate({
      skuId,
      channelId: editingChannelId,
      price: cpForm.price || null,
      floorPrice: cpForm.floorPrice || null,
      ceilingPrice: cpForm.ceilingPrice || null,
      targetMarginPct: cpForm.targetMarginPct ? String(Number(cpForm.targetMarginPct) / 100) : null,
      competitorPrice: cpForm.competitorPrice || null,
      notes: cpForm.notes || null,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading SKU…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <p className="text-sm">SKU not found.</p>
        <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to SKU Costing
        </Button>
      </div>
    );
  }

  const { sku, pricing } = data;

  const channelMap = new Map((channels ?? []).map(c => [c.id, c]));

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono text-primary">{sku.sku}</h1>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="ml-auto shrink-0">
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />Edit SKU
            </Button>
            <Badge variant={sku.status === "active" ? "default" : "secondary"} className="capitalize">
              {sku.status}
            </Badge>
            {sku.isBd && <Badge variant="outline" className="text-blue-600 border-blue-300">B&D</Badge>}
            {sku.supplier && <Badge variant="outline" className="text-teal-600 border-teal-300">{sku.supplier}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{sku.description}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {sku.productGroup && <span>{sku.productGroup}</span>}
            {sku.var1 && <span>· Var1: {sku.var1}</span>}
            {sku.var2 && <span>· Var2: {sku.var2}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Pricing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <Tag className="h-3.5 w-3.5" />Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="SRP 2023" value={fmt(pricing?.srp2023)} />
            <Row label="SRP 2024" value={fmt(pricing?.srp2024)} />
            <Row label="MAP" value={fmt(pricing?.map)} />
            <Row label="SRP 2024 (Amazon)" value={fmt(pricing?.srp2024Amzn)} />
            <Row label="Wholesale (Pool City)" value={fmt(pricing?.wholesalePoolCity)} />
            <Row label="PPTG 25 Wholesale" value={fmt(pricing?.pptg25WholesalePrice)} />
            <Row label="BD Wholesale 24" value={fmt(pricing?.bdWholesaleRetail24)} />
            <Row label="BD Wholesale 25" value={fmt(pricing?.bdWholesaleRetail25)} />
            <Row label="2024 Comps" value={fmt(pricing?.comps2024)} />
          </CardContent>
        </Card>

        {/* Costing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <DollarSign className="h-3.5 w-3.5" />Costing
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="Factory Cost" value={fmt(pricing?.factoryCost)} />
            <Row label="FOB 26 Costing" value={fmt(pricing?.fob26Costing)} />
            <Row label="Tariff %" value={pct(pricing?.tariffPct)} />
            <Row label="Tariff Amt" value={fmt(pricing?.tariffAmt)} />
            <Row label="Duty %" value={pct(pricing?.dutyPct)} />
            <Row label="Duty Amt" value={fmt(pricing?.dutyAmt)} />
            <Row label="Freight" value={fmt(pricing?.freight)} />
            <Row label="Freight Alt" value={fmt(pricing?.freightAlt)} />
            <Row label="Load %" value={pct(pricing?.loadPct)} />
            <Row label="BD License Fee %" value={pct(pricing?.bdLicenseFeePct)} />
            <Row label="Asia Margin %" value={pct(pricing?.asiaMarginPct)} />
            <Row label="BD Fee" value={fmt(pricing?.bdFee)} />
            <Row label="Landed Cost" value={<span className="font-bold">{fmt(pricing?.landedCost)}</span>} />
            <Row label="Landed + BD Fees" value={fmt(pricing?.landedPlusBdFees)} />
          </CardContent>
        </Card>

        {/* Margins */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" />Margins
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="BD Wholesale Margin %" value={pct(pricing?.bdWholesaleMarginPct)} />
            <Row label="BD Margin" value={fmt(pricing?.bdMargin)} />
            <Row
              label="BD Margin %"
              value={<span className={marginColor(pricing?.bdMarginPct)}>{pct(pricing?.bdMarginPct)}</span>}
            />
            <Row label="Margin" value={fmt(pricing?.margin)} />
            <Row label="SRP Margin" value={fmt(pricing?.srpMargin)} />
            <Row label="Inc 24→25 %" value={pct(pricing?.inc2425Pct)} />
            <Row label="Adjusted" value={pricing?.adjusted ? "Yes" : "No"} />
            <Row label="Notes" value={<span className="text-muted-foreground italic max-w-[180px] truncate">{pricing?.notes || "—"}</span>} />
          </CardContent>
        </Card>

        {/* Sourcing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <Truck className="h-3.5 w-3.5" />Sourcing
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="Supplier" value={sku.supplier} />
            <Row label="HTS Code" value={<span className="font-mono">{sku.htsCode}</span>} />
            <Row label="Source Status" value={sku.sourceStatus} />
            <Row label="Packing Type" value={sku.packingType} />
            <Row label="Pcs / Carton" value={sku.pcsPerCarton} />
            <Row label="Carton L × W × H (cm)" value={sku.cartonL && sku.cartonW && sku.cartonH ? `${sku.cartonL} × ${sku.cartonW} × ${sku.cartonH}` : "—"} />
            <Row label="Gross Weight (kg)" value={sku.grossWtKg} />
            <Row label="Net Weight (kg)" value={sku.netWtKg} />
          </CardContent>
        </Card>

        {/* Sales YTD */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" />Sales YTD
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="Sales Qty 2024 YTD" value={sku.salesQty2024Ytd ? Number(sku.salesQty2024Ytd).toLocaleString() : "—"} />
            <Row label="Avg Price 2024 YTD" value={fmt(sku.avgPrice2024Ytd)} />
            <Row label="Sales Amt 2024 YTD" value={fmt(sku.salesAmt2024Ytd)} />
          </CardContent>
        </Card>
      </div>

      {/* Channel Prices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
            <DollarSign className="h-3.5 w-3.5" />Channel Prices
            <span className="ml-1 text-[10px] text-muted-foreground font-normal normal-case">Click a row to edit</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {channelLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />Loading channel prices…
            </div>
          ) : !channelPrices || channelPrices.length === 0 ? (
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">No channel prices set for this SKU yet.</p>
              <div className="flex flex-wrap gap-2">
                {(channels ?? []).map(ch => (
                  <Popover key={ch.id} open={editingChannelId === ch.id} onOpenChange={(open) => { if (!open) setEditingChannelId(null); }}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openCpEdit(ch.id)}>
                        <Pencil className="h-3 w-3 mr-1.5" />{ch.name}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-4" align="start">
                      <div className="space-y-3">
                        <p className="text-xs font-semibold">{ch.name} — Set Price</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Price</Label>
                            <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.price} onChange={e => setCpForm(f => ({ ...f, price: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Target Margin %</Label>
                            <Input className="h-7 text-xs" placeholder="35" value={cpForm.targetMarginPct} onChange={e => setCpForm(f => ({ ...f, targetMarginPct: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Floor Price</Label>
                            <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.floorPrice} onChange={e => setCpForm(f => ({ ...f, floorPrice: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Ceiling Price</Label>
                            <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.ceilingPrice} onChange={e => setCpForm(f => ({ ...f, ceilingPrice: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Competitor Price</Label>
                            <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.competitorPrice} onChange={e => setCpForm(f => ({ ...f, competitorPrice: e.target.value }))} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notes</Label>
                          <Textarea className="text-xs min-h-[56px] resize-none" placeholder="Notes…" value={cpForm.notes} onChange={e => setCpForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingChannelId(null)}>Cancel</Button>
                          <Button size="sm" className="h-7 text-xs" onClick={saveCpEdit} disabled={upsertChannelPrice.isPending}>
                            {upsertChannelPrice.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Channel</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Type</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Price</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Floor</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Ceiling</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Margin %</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Target %</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Competitor</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Notes</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {channelPrices.map(cp => {
                    const ch = channelMap.get(cp.channelId);
                    const isEditingThis = editingChannelId === cp.channelId;
                    return (
                      <tr key={cp.id} className="border-b last:border-0 hover:bg-muted/20 group">
                        <td className="px-3 py-2 font-medium">{ch?.name ?? `Channel ${cp.channelId}`}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={ch?.type === "online" ? "text-blue-600 border-blue-200" : "text-purple-600 border-purple-200"}>
                            {ch?.type ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(cp.price)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(cp.floorPrice)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(cp.ceilingPrice)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${marginColor(cp.marginPct)}`}>{pct(cp.marginPct)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{pct(cp.targetMarginPct)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(cp.competitorPrice)}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{cp.notes || "—"}</td>
                        <td className="px-3 py-2">
                          <Popover open={isEditingThis} onOpenChange={(open) => { if (!open) setEditingChannelId(null); }}>
                            <PopoverTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => openCpEdit(cp.channelId)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-4" align="end">
                              <div className="space-y-3">
                                <p className="text-xs font-semibold">{ch?.name} — Edit Price</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Price</Label>
                                    <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.price} onChange={e => setCpForm(f => ({ ...f, price: e.target.value }))} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Target Margin %</Label>
                                    <Input className="h-7 text-xs" placeholder="35" value={cpForm.targetMarginPct} onChange={e => setCpForm(f => ({ ...f, targetMarginPct: e.target.value }))} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Floor Price</Label>
                                    <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.floorPrice} onChange={e => setCpForm(f => ({ ...f, floorPrice: e.target.value }))} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Ceiling Price</Label>
                                    <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.ceilingPrice} onChange={e => setCpForm(f => ({ ...f, ceilingPrice: e.target.value }))} />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Competitor Price</Label>
                                    <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.competitorPrice} onChange={e => setCpForm(f => ({ ...f, competitorPrice: e.target.value }))} />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Notes</Label>
                                  <Textarea className="text-xs min-h-[56px] resize-none" placeholder="Notes…" value={cpForm.notes} onChange={e => setCpForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingChannelId(null)}>Cancel</Button>
                                  <Button size="sm" className="h-7 text-xs" onClick={saveCpEdit} disabled={upsertChannelPrice.isPending}>
                                    {upsertChannelPrice.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Unpriced channels — always show below table when some channels exist */}
          {!channelLoading && channelPrices && channelPrices.length > 0 && (() => {
            const pricedIds = new Set(channelPrices.map(cp => cp.channelId));
            const unpriced = (channels ?? []).filter(ch => !pricedIds.has(ch.id));
            if (unpriced.length === 0) return null;
            return (
              <div className="mt-3 pt-3 border-t">
                <p className="text-[11px] text-muted-foreground mb-2 font-medium">Add price for:</p>
                <div className="flex flex-wrap gap-1.5">
                  {unpriced.map(ch => (
                    <Popover key={ch.id} open={editingChannelId === ch.id} onOpenChange={(open) => { if (!open) setEditingChannelId(null); }}>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => openCpEdit(ch.id)}>
                          <Pencil className="h-2.5 w-2.5 mr-1" />{ch.name}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4" align="start">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold">{ch.name} — Set Price</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Price</Label>
                              <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.price} onChange={e => setCpForm(f => ({ ...f, price: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Target Margin %</Label>
                              <Input className="h-7 text-xs" placeholder="35" value={cpForm.targetMarginPct} onChange={e => setCpForm(f => ({ ...f, targetMarginPct: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Floor Price</Label>
                              <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.floorPrice} onChange={e => setCpForm(f => ({ ...f, floorPrice: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Ceiling Price</Label>
                              <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.ceilingPrice} onChange={e => setCpForm(f => ({ ...f, ceilingPrice: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Competitor Price</Label>
                              <Input className="h-7 text-xs" placeholder="0.00" value={cpForm.competitorPrice} onChange={e => setCpForm(f => ({ ...f, competitorPrice: e.target.value }))} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Notes</Label>
                            <Textarea className="text-xs min-h-[56px] resize-none" placeholder="Notes…" value={cpForm.notes} onChange={e => setCpForm(f => ({ ...f, notes: e.target.value }))} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingChannelId(null)}>Cancel</Button>
                            <Button size="sm" className="h-7 text-xs" onClick={saveCpEdit} disabled={upsertChannelPrice.isPending}>
                              {upsertChannelPrice.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Carton Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
            <Package className="h-3.5 w-3.5" />Carton Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {cartonLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />Loading carton details…
            </div>
          ) : !cartonDetails || cartonDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No carton details on file for this SKU.</p>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Carton #</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Label</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Component SKU</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qty</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Sellable</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">L × W × H (cm)</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Gross Wt (kg)</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Net Wt (kg)</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Pcs/Ctn</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Packing</th>
                  </tr>
                </thead>
                <tbody>
                  {cartonDetails.map((cd, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{cd.cartonNum ?? "—"}</td>
                      <td className="px-3 py-2">{cd.cartonLabel ?? "—"}</td>
                      <td className="px-3 py-2 font-mono font-medium">{cd.componentSku ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{cd.qtyPerParent ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {cd.componentSellable ? <Badge variant="default" className="text-[10px] py-0">Yes</Badge> : <Badge variant="secondary" className="text-[10px] py-0">No</Badge>}
                      </td>
                      <td className="px-3 py-2 text-right">{cd.cartonL && cd.cartonW && cd.cartonH ? `${cd.cartonL} × ${cd.cartonW} × ${cd.cartonH}` : "—"}</td>
                      <td className="px-3 py-2 text-right">{cd.grossWtKg ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{cd.netWtKg ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{cd.pcsPerCarton ?? "—"}</td>
                      <td className="px-3 py-2">{cd.packingType ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price History */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <Clock className="h-3.5 w-3.5" />Price Change History
            </CardTitle>
            <div className="flex items-center gap-2">
              {showHistory && (
                <select
                  className="text-xs border rounded px-2 py-1 bg-background"
                  value={historyChannelId ?? ""}
                  onChange={e => setHistoryChannelId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">All Channels</option>
                  {(channels ?? []).map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs gap-1"
                onClick={() => setShowHistory(v => !v)}
              >
                {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showHistory ? "Hide" : "Show history"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent className="pt-0">
            {historyLoading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />Loading history…
              </div>
            ) : !priceHistory || priceHistory.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No price changes recorded yet. Changes will appear here after the first edit.</p>
            ) : (
              <div className="overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">When</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Channel</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Old Price</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">New Price</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Old Margin</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">New Margin</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.rows.map(h => {
                      const oldM = Number(h.oldMarginPct ?? 0);
                      const newM = Number(h.newMarginPct ?? 0);
                      const improved = newM > oldM;
                      return (
                        <tr key={h.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {new Date(h.changedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-medium">{h.channelName}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(h.oldPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(h.newPrice)}</td>
                          <td className={`px-3 py-2 text-right ${marginColor(h.oldMarginPct)}`}>{pct(h.oldMarginPct)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${marginColor(h.newMarginPct)}`}>
                            {pct(h.newMarginPct)}
                            {h.oldMarginPct !== null && h.newMarginPct !== null && (
                              <span className={`ml-1 text-[10px] ${improved ? 'text-emerald-500' : 'text-red-400'}`}>
                                {improved ? '▲' : '▼'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground capitalize">{h.changeSource ?? 'manual'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {priceHistory.total > 100 && (
                  <p className="text-[11px] text-muted-foreground px-3 py-2 border-t">
                    Showing 100 of {priceHistory.total.toLocaleString()} changes
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Edit Dialog */}
      {editing && data && (
        <EditSKUDialog
          open={editing}
          sku={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            utils.skus.get.invalidate({ id: skuId });
          }}
        />
      )}
    </div>
  );
}
