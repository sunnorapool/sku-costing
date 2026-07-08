import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EditSKUDialog from "@/components/EditSKUDialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Box,
  DollarSign,
  Edit2,
  Loader2,
  Package,
  Tag,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useState } from "react";
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SKUDetail({ skuId }: { skuId: number }) {
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.skus.get.useQuery({ id: skuId });
  const { data: cartonDetails, isLoading: cartonLoading } = trpc.skus.cartonDetails.useQuery({ skuId });
  const { data: channelPrices, isLoading: channelLoading } = trpc.channelPrices.bySku.useQuery({ skuId });
  const { data: channels } = trpc.channels.list.useQuery();

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
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {channelLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />Loading channel prices…
            </div>
          ) : !channelPrices || channelPrices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No channel prices set for this SKU yet.</p>
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
                  </tr>
                </thead>
                <tbody>
                  {channelPrices.map(cp => {
                    const ch = channelMap.get(cp.channelId);
                    return (
                      <tr key={cp.id} className="border-b last:border-0 hover:bg-muted/20">
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
