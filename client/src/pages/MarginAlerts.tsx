import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowUpDown,
  Loader2,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  if (isNaN(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

type SortKey = "margin" | "sku" | "channel" | "price";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MarginAlerts() {
  const [, setLocation] = useLocation();
  const [channelId, setChannelId] = useState<number | undefined>(undefined);
  const [threshold, setThreshold] = useState(20); // percent slider
  const [sortKey, setSortKey] = useState<SortKey>("margin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: channels } = trpc.channels.list.useQuery();
  const { data: alerts, isLoading } = trpc.channelPrices.marginAlerts.useQuery({
    channelId,
    thresholdPct: threshold / 100,
  });

  const sorted = useMemo(() => {
    if (!alerts) return [];
    return [...alerts].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortKey === "margin") { av = Number(a.marginPct ?? -999); bv = Number(b.marginPct ?? -999); }
      else if (sortKey === "sku") { av = a.skuCode; bv = b.skuCode; }
      else if (sortKey === "channel") { av = a.channelName; bv = b.channelName; }
      else if (sortKey === "price") { av = Number(a.price ?? 0); bv = Number(b.price ?? 0); }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
    });
  }, [alerts, sortKey, sortDir]);

  // Summary stats
  const byChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of (alerts ?? [])) {
      map.set(a.channelName, (map.get(a.channelName) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  const byGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of (alerts ?? [])) {
      const g = a.productGroup ?? "Unknown";
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [alerts]);

  const belowFloorCount = (alerts ?? []).filter(a => {
    const price = Number(a.price ?? 0);
    const floor = Number(a.floorPrice ?? 0);
    return floor > 0 && price < floor;
  }).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Margin Alerts
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          SKUs where channel price is below the floor price or margin is below the threshold.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Channel:</span>
          <Select
            value={channelId ? String(channelId) : "all"}
            onValueChange={v => setChannelId(v === "all" ? undefined : Number(v))}
          >
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {(channels ?? []).map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 min-w-[260px]">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Threshold:</span>
          <Slider
            min={5}
            max={50}
            step={1}
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
            className="w-32"
          />
          <span className="text-sm font-medium w-10">{threshold}%</span>
        </div>
      </div>

      {/* Summary Cards */}
      {!isLoading && alerts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-orange-200 bg-orange-50/30">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{alerts.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Alerts</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{belowFloorCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Below Floor Price</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-semibold mb-1">By Channel</div>
              <div className="space-y-0.5">
                {byChannel.slice(0, 4).map(([name, count]) => (
                  <div key={name} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[120px]">{name}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-semibold mb-1">By Product Group</div>
              <div className="space-y-0.5">
                {byGroup.map(([name, count]) => (
                  <div key={name} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[120px]">{name}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-orange-500" />
            {isLoading ? "Loading…" : `${sorted.length} SKU${sorted.length !== 1 ? "s" : ""} flagged`}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Scanning for alerts…</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 opacity-20" />
              <p className="text-sm">No alerts at the current threshold ({threshold}%).</p>
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("sku")}>
                      <span className="flex items-center gap-1">SKU <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Description</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Group</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("channel")}>
                      <span className="flex items-center gap-1">Channel <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("price")}>
                      <span className="flex items-center gap-1 justify-end">Price <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Floor</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Landed Cost</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("margin")}>
                      <span className="flex items-center gap-1 justify-end">Margin % <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Target %</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Issue</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((alert, i) => {
                    const price = Number(alert.price ?? 0);
                    const floor = Number(alert.floorPrice ?? 0);
                    const margin = Number(alert.marginPct ?? 0);
                    const belowFloor = floor > 0 && price < floor;
                    const belowThreshold = margin < threshold / 100;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <button
                            className="font-mono font-medium text-primary hover:underline"
                            onClick={() => setLocation(`/sku/${alert.skuId}`)}
                          >
                            {alert.skuCode}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">{alert.description}</td>
                        <td className="px-3 py-2 text-muted-foreground">{alert.productGroup ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={alert.channelType === "online" ? "text-blue-600 border-blue-200" : "text-purple-600 border-purple-200"}>
                            {alert.channelName}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(alert.price)}</td>
                        <td className={`px-3 py-2 text-right ${belowFloor ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>{fmt(alert.floorPrice)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(alert.landedCost)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${marginColor(alert.marginPct)}`}>{pct(alert.marginPct)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{pct(alert.targetMarginPct)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex gap-1 justify-center flex-wrap">
                            {belowFloor && <Badge variant="destructive" className="text-[10px] py-0 px-1">Below Floor</Badge>}
                            {belowThreshold && <Badge className="text-[10px] py-0 px-1 bg-orange-500 hover:bg-orange-500">Low Margin</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setLocation(`/channel-pricing`)}
                          >
                            Fix Price
                          </Button>
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
    </div>
  );
}
