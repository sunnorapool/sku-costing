import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  HelpCircle,
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

// A row with an optional tooltip explaining the formula/source
function Row({
  label,
  value,
  tooltip,
  className = "",
  bold = false,
}: {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
  className?: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b last:border-0 ${className}`}>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tooltip && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      <span className={`text-xs text-right max-w-[60%] ${bold ? "font-bold" : "font-medium"}`}>{value ?? "—"}</span>
    </div>
  );
}

// A separator row used as a sub-total divider inside the cost breakdown
function SubtotalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 bg-muted/30 px-2 rounded -mx-2 mt-1 mb-0.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="text-xs font-bold text-foreground">{value ?? "—"}</span>
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

  // ── Channel price edit popover (shared) ──────────────────────────────────
  function CpEditForm({ channelName }: { channelName: string }) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold">{channelName}</p>
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
    );
  }

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
            {sku.fob2027Status === "confirmed" && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">2027 FOB Confirmed</Badge>
            )}
            {sku.fob2027Status === "placeholder" && (
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">2027 FOB Placeholder</Badge>
            )}
            {sku.fob2027Status === "missing" && (
              <Badge className="bg-red-100 text-red-700 border-red-300">2027 FOB Missing</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{sku.description}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {sku.productGroup && <span>{sku.productGroup}</span>}
            {sku.var1 && <span>· {sku.var1}</span>}
            {sku.var2 && <span>· {sku.var2}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* ── Retail & Wholesale Pricing ───────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <Tag className="h-3.5 w-3.5" />Retail &amp; Wholesale Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="SRP 2023" value={fmt(pricing?.srp2023)} tooltip="Suggested Retail Price for the 2023 season." />
            <Row label="SRP 2024" value={fmt(pricing?.srp2024)} tooltip="Suggested Retail Price for the 2024 season." />
            <Row label="MAP" value={fmt(pricing?.map)} tooltip="Minimum Advertised Price — the floor price dealers may advertise publicly." />
            <Row label="Amazon SRP 2024" value={fmt(pricing?.srp2024Amzn)} tooltip="Amazon-specific SRP for 2024, which may differ from the standard SRP due to Amazon pricing rules." />
            <Row label="Pool City Wholesale" value={fmt(pricing?.wholesalePoolCity)} tooltip="Wholesale price set for Pool City." />
            <Row label="PPTG 2025 Wholesale" value={fmt(pricing?.pptg25WholesalePrice)} tooltip="Wholesale price for poolpartstogo.com for the 2025 season." />
            <Row label="B&D Wholesale 2024" value={fmt(pricing?.bdWholesaleRetail24)} tooltip="Blue Devil / B&D brand wholesale price for 2024." />
            <Row label="B&D Wholesale 2025" value={fmt(pricing?.bdWholesaleRetail25)} tooltip="Blue Devil / B&D brand wholesale price for 2025." />
            <Row label="2024 Comps" value={fmt(pricing?.comps2024)} tooltip="Competitor pricing reference for 2024 — used for market positioning." />
          </CardContent>
        </Card>

        {/* ── Import Cost Breakdown ─────────────────────────────────────────── */}
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <DollarSign className="h-3.5 w-3.5" />Import Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {/* Left column: FOB & tariffs */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-0.5">Origin Costs</p>
                <Row
                  label="2026 FOB Cost"
                  value={fmt(pricing?.fob26Costing)}
                  tooltip="Free On Board cost for the 2026 season — the price paid to the factory at the origin port, before any shipping or duties. Source: supplier quote."
                />
                <Row
                  label="2027 FOB Quote"
                  value={sku.fob2027Price ? fmt(sku.fob2027Price) : "—"}
                  tooltip="Confirmed or estimated FOB cost for 2027. Green = confirmed quote from Ian's verified supplier database. Yellow = estimated from 2026 legacy cost. Red = no cost on file."
                />
                <Row
                  label="Factory / FOB Cost"
                  value={fmt(pricing?.factoryCost)}
                  tooltip="Factory cost before FOB loading. May differ from FOB if origin handling is tracked separately. Formula: FOB Cost − Origin Load."
                />
                <Row
                  label="Origin Load %"
                  value={pct(pricing?.loadPct)}
                  tooltip="Percentage of FOB added to cover inland trucking from factory to origin port (e.g., Nanjing → Ningbo). Typically 3–7%. Formula: FOB × Load % = Load $."
                />
                <Row
                  label="Supplier Margin %"
                  value={pct(pricing?.asiaMarginPct)}
                  tooltip="Supplier's own margin built into the FOB price. Informational only — not added to landed cost, already embedded in the FOB figure."
                />

                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-3">Tariffs &amp; Duties</p>
                <Row
                  label="Import Tariff Rate"
                  value={pct(pricing?.tariffPct)}
                  tooltip="Combined Section 301 + Section 232 + Section 122 tariff rate applied to the FOB value. Formula: FOB × Total Tariff % = Tariff $. Source: USTR tariff schedule by HTS code."
                />
                <Row
                  label="Tariff Amount"
                  value={fmt(pricing?.tariffAmt)}
                  tooltip="Dollar amount of combined import tariffs. Formula: FOB × Import Tariff Rate."
                />
                <Row
                  label="Base Duty Rate"
                  value={pct(pricing?.dutyPct)}
                  tooltip="Standard HTS duty rate (not Section 301/232/122). This is the normal customs duty for the product category. Source: HTSUS schedule."
                />
                <Row
                  label="Base Duty Amount"
                  value={fmt(pricing?.dutyAmt)}
                  tooltip="Dollar amount of standard HTS duty. Formula: FOB × Base Duty Rate."
                />
                <Row
                  label="B&D Royalty %"
                  value={pct(pricing?.bdLicenseFeePct)}
                  tooltip="Blue Devil / B&D brand license fee as a percentage. Applied inside the list price formula (not added to landed cost). Formula: List Price = Landed Cost ÷ (1 − Margin% − Royalty%)."
                />
                <Row
                  label="B&D Fee Amount"
                  value={fmt(pricing?.bdFee)}
                  tooltip="Dollar value of the B&D brand royalty at the current price. Informational — shows the royalty cost embedded in the price."
                />
              </div>

              {/* Right column: freight & totals */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-0.5">Freight &amp; Import Fees</p>
                <Row
                  label="Ocean Freight"
                  value={fmt(pricing?.freight)}
                  tooltip="Ocean freight cost allocated to this unit. Formula: Unit Cu Ft × $/cu ft rate. Unit Cu Ft = (L cm × W cm × H cm) ÷ 1,000,000 × 35.3147 ÷ Pcs per Carton. Rate: confirm with Chuck."
                />
                <Row
                  label="Freight (Alt)"
                  value={fmt(pricing?.freightAlt)}
                  tooltip="Alternate freight calculation — used for comparison or for SKUs with non-standard shipping arrangements."
                />
                <Row
                  label="Harbor Maintenance Fee"
                  value="0.125% of FOB"
                  tooltip="HMF: 0.125% of FOB value. Applied to all commercial cargo entering US ports. Regulatory rate — 19 CFR 24.24."
                />
                <Row
                  label="Merchandise Processing Fee"
                  value="0.3464% of FOB"
                  tooltip="MPF: 0.3464% of FOB value. Applied to all formal customs entries. Min $32.71, max $634.62 per entry (2024 rates). Regulatory rate — 19 CFR 24.23."
                />
                <Row
                  label="Drayage"
                  value="$600/container (allocated)"
                  tooltip="Drayage charge of $600 per container, allocated per unit by cubic feet. Formula: Unit Cu Ft × ($600 ÷ 2,400 cu ft). Source: Chuck's confirmed rate."
                />

                <div className="mt-3 pt-2 border-t">
                  <SubtotalRow
                    label="Total Landed Cost"
                    value={<span className="text-emerald-700">{fmt(pricing?.landedCost)}</span>}
                  />
                  <Row
                    label="Landed + B&D Fees"
                    value={fmt(pricing?.landedPlusBdFees)}
                    tooltip="Landed Cost plus the B&D royalty amount. Used as the cost basis when 'Factory Cost' pricing mode is selected in Dealer Pricing assumptions."
                    bold
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Margins ──────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" />Margins
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row
              label="B&D Wholesale Margin %"
              value={pct(pricing?.bdWholesaleMarginPct)}
              tooltip="Target margin % for B&D wholesale channel. Formula: (Wholesale Price − Landed Cost) ÷ Wholesale Price."
            />
            <Row
              label="B&D Margin Amount"
              value={fmt(pricing?.bdMargin)}
              tooltip="Dollar margin on B&D wholesale. Formula: Wholesale Price − Landed Cost."
            />
            <Row
              label="B&D Margin %"
              value={<span className={marginColor(pricing?.bdMarginPct)}>{pct(pricing?.bdMarginPct)}</span>}
              tooltip="Actual B&D margin % achieved. Color: green ≥35%, yellow ≥25%, orange ≥15%, red <15%."
            />
            <Row
              label="Margin Amount"
              value={fmt(pricing?.margin)}
              tooltip="Dollar margin at the primary channel price."
            />
            <Row
              label="SRP Margin"
              value={fmt(pricing?.srpMargin)}
              tooltip="Dollar margin at the Suggested Retail Price."
            />
            <Row
              label="Price Increase 2024→2025"
              value={pct(pricing?.inc2425Pct)}
              tooltip="Year-over-year price increase from 2024 to 2025. Formula: (SRP 2025 − SRP 2024) ÷ SRP 2024."
            />
            <Row label="Adjusted" value={pricing?.adjusted ? "Yes" : "No"} tooltip="Indicates whether this SKU's price was manually adjusted outside the standard formula." />
            <Row label="Notes" value={<span className="text-muted-foreground italic max-w-[180px] truncate">{pricing?.notes || "—"}</span>} />
          </CardContent>
        </Card>

        {/* ── Sourcing ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <Truck className="h-3.5 w-3.5" />Sourcing
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row label="Supplier" value={sku.supplier} tooltip="Factory or supplier name. Used to filter and group SKUs in the pricing matrix." />
            <Row
              label="HTS Code"
              value={<span className="font-mono">{sku.htsCode}</span>}
              tooltip="Harmonized Tariff Schedule code. Determines the base duty rate and applicable Section 301/232/122 tariff rates. Look up at hts.usitc.gov."
            />
            <Row label="Source Status" value={sku.sourceStatus} tooltip="Current sourcing status: Active, Discontinued, New Model, etc." />
            <Row label="Packing Type" value={sku.packingType} tooltip="How the product is packed for shipping: master carton, inner pack, single, etc." />
            <Row label="Pcs per Carton" value={sku.pcsPerCarton} tooltip="Number of units per master carton. Used to calculate per-unit cubic footage for freight allocation." />
            <Row
              label="Carton L × W × H (cm)"
              value={sku.cartonL && sku.cartonW && sku.cartonH ? `${sku.cartonL} × ${sku.cartonW} × ${sku.cartonH}` : "—"}
              tooltip="Master carton dimensions in centimeters. Used to compute cubic footage: (L × W × H) ÷ 1,000,000 × 35.3147 ÷ Pcs per Carton = Unit Cu Ft."
            />
            <Row label="Gross Weight (kg)" value={sku.grossWtKg} tooltip="Gross weight of the master carton including packaging, in kilograms." />
            <Row label="Net Weight (kg)" value={sku.netWtKg} tooltip="Net weight of the product only (no packaging), in kilograms." />
          </CardContent>
        </Card>

        {/* ── Sales History ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" />Sales History (2024–25 YTD)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Row
              label="Units Sold"
              value={sku.salesQty2024Ytd ? Number(sku.salesQty2024Ytd).toLocaleString() : "—"}
              tooltip="Total units sold in the 2024–25 season year-to-date. Source: Ian's verified sales database."
            />
            <Row
              label="Average Selling Price"
              value={fmt(sku.avgPrice2024Ytd)}
              tooltip="Average price per unit actually received from customers in the 2024–25 season. Used as the 'prior year price paid' baseline in the 2027 dealer PNL analysis."
            />
            <Row
              label="Total Sales Amount"
              value={fmt(sku.salesAmt2024Ytd)}
              tooltip="Total revenue from this SKU in the 2024–25 season. Formula: Units Sold × Average Selling Price."
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Channel Prices ────────────────────────────────────────────────── */}
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
                      <CpEditForm channelName={`${ch.name} — Set Price`} />
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
                              <CpEditForm channelName={`${ch?.name ?? "Channel"} — Edit Price`} />
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
          {/* Unpriced channels */}
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
                        <CpEditForm channelName={`${ch.name} — Set Price`} />
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ── Carton Details ────────────────────────────────────────────────── */}
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
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Cu Ft/Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {cartonDetails.map((cd, i) => {
                    const cuFt = cd.cartonL && cd.cartonW && cd.cartonH && cd.pcsPerCarton
                      ? ((Number(cd.cartonL) * Number(cd.cartonW) * Number(cd.cartonH)) / 1_000_000 * 35.3147 / Number(cd.pcsPerCarton))
                      : null;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">{cd.cartonNum ?? "—"}</td>
                        <td className="px-3 py-2">{cd.cartonLabel ?? "—"}</td>
                        <td className="px-3 py-2 font-mono">{cd.componentSku ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{cd.qtyPerParent ?? "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {cd.componentSellable ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px]">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">No</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {cd.cartonL && cd.cartonW && cd.cartonH
                            ? `${cd.cartonL} × ${cd.cartonW} × ${cd.cartonH}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">{cd.grossWtKg ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{cd.netWtKg ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{cd.pcsPerCarton ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {cuFt !== null ? cuFt.toFixed(4) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Price History ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
              <Clock className="h-3.5 w-3.5" />Channel Price History
            </CardTitle>
            <div className="flex items-center gap-2">
              {showHistory && (
                <select
                  className="text-xs border rounded px-2 py-1 bg-background"
                  value={historyChannelId ?? ""}
                  onChange={e => setHistoryChannelId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">All channels</option>
                  {(channels ?? []).map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowHistory(v => !v)}
              >
                {showHistory ? (
                  <><ChevronUp className="h-3.5 w-3.5 mr-1" />Hide</>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5 mr-1" />Show History</>
                )}
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
              <p className="text-sm text-muted-foreground py-4">No price changes recorded for this SKU.</p>
            ) : (
              <div className="overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Channel</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Old Price</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">New Price</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Old Margin</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground">New Margin</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Date</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceHistory.rows.map((h, i: number) => {
                      const ch = channelMap.get(h.channelId);
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{ch?.name ?? `Channel ${h.channelId}`}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{fmt(h.oldPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(h.newPrice)}</td>
                          <td className={`px-3 py-2 text-right ${marginColor(h.oldMarginPct)}`}>{pct(h.oldMarginPct)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${marginColor(h.newMarginPct)}`}>{pct(h.newMarginPct)}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {h.changedAt ? new Date(h.changedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{h.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {editing && (
        <EditSKUDialog
          open={editing}
          sku={data}
          onClose={() => {
            setEditing(false);
            utils.skus.get.invalidate({ id: skuId });
          }}
          onSaved={() => {
            setEditing(false);
            utils.skus.get.invalidate({ id: skuId });
          }}
        />
      )}
    </div>
  );
}
