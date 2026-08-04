import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Package,
  DollarSign,
  Ruler,
  Weight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

type LookupResult = {
  id: number;
  skuCode: string;
  description: string | null;
  productGroup: string | null;
  supplier: string | null;
  htsCode: string | null;
  fob2027Price: string | null;
  fob2027Status: "confirmed" | "placeholder" | "missing" | null;
  cartonL: string | null;
  cartonW: string | null;
  cartonH: string | null;
  grossWtKg: string | null;
  netWtKg: string | null;
  pcsPerCarton: string | null;
  landedCost: string | null | undefined;
  tariffPct: string | null | undefined;
  tariffAmt: string | null | undefined;
  dutyAmt: string | null | undefined;
  srp2024: string | null | undefined;
  map: string | null | undefined;
  fob26Costing: string | null | undefined;
};

function fmt(val: string | null | undefined, prefix = "$", decimals = 2): string {
  if (!val || val === "0" || val === "0.00") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${prefix}${n.toFixed(decimals)}`;
}

function fmtPct(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function fmtDim(l: string | null, w: string | null, h: string | null): string {
  if (!l && !w && !h) return "—";
  const parts = [l, w, h].map(v => (v ? parseFloat(v).toFixed(1) : "?"));
  return `${parts[0]} × ${parts[1]} × ${parts[2]} cm`;
}

function FobStatusBadge({ status }: { status: LookupResult["fob2027Status"] }) {
  if (!status) return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  if (status === "confirmed")
    return <Badge className="bg-emerald-600 text-white text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Confirmed</Badge>;
  if (status === "placeholder")
    return <Badge className="bg-amber-500 text-white text-xs gap-1"><Clock className="w-3 h-3" />Placeholder</Badge>;
  return <Badge className="bg-red-500 text-white text-xs gap-1"><AlertTriangle className="w-3 h-3" />Missing</Badge>;
}

function SkuCard({ item }: { item: LookupResult }) {
  const hasDims = item.cartonL || item.cartonW || item.cartonH;
  const hasLanded = item.landedCost && parseFloat(item.landedCost) > 0;

  return (
    <Card className="border border-border hover:border-primary/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-base text-primary">{item.skuCode}</span>
              {item.productGroup && (
                <Badge variant="outline" className="text-xs">{item.productGroup}</Badge>
              )}
              <FobStatusBadge status={item.fob2027Status} />
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1 leading-snug">{item.description}</p>
            )}
          </div>
        </div>
        {item.supplier && (
          <p className="text-xs text-muted-foreground">Supplier: <span className="text-foreground">{item.supplier}</span></p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pricing section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <DollarSign className="w-3.5 h-3.5" />
            Pricing
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">2027 FOB</span>
              <p className="font-semibold">{fmt(item.fob2027Price)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">2026 FOB Cost</span>
              <p className="font-semibold">{fmt(item.fob26Costing)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Landed Cost</span>
              <p className={`font-semibold ${!hasLanded ? "text-muted-foreground" : ""}`}>
                {hasLanded ? fmt(item.landedCost) : "Needs dims"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">SRP 2024</span>
              <p className="font-semibold">{fmt(item.srp2024)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">MAP</span>
              <p className="font-semibold">{fmt(item.map)}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Tariff section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <HelpCircle className="w-3.5 h-3.5" />
            Tariff &amp; Duty
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">HTS Code</span>
              <p className="font-mono text-xs font-semibold">{item.htsCode || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Tariff Rate</span>
              <p className="font-semibold">{fmtPct(item.tariffPct)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Tariff Amt</span>
              <p className="font-semibold">{fmt(item.tariffAmt)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Base Duty</span>
              <p className="font-semibold">{fmt(item.dutyAmt)}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Carton dims section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Ruler className="w-3.5 h-3.5" />
            Carton Dimensions
          </div>
          {hasDims ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">L × W × H</span>
                <p className="font-semibold">{fmtDim(item.cartonL, item.cartonW, item.cartonH)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Pcs / Carton</span>
                <p className="font-semibold">{item.pcsPerCarton ? parseFloat(item.pcsPerCarton).toFixed(0) : "—"}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs">Gross / Net Wt</span>
                <p className="font-semibold">
                  {item.grossWtKg ? `${parseFloat(item.grossWtKg).toFixed(2)} kg` : "—"}
                  {item.netWtKg ? ` / ${parseFloat(item.netWtKg).toFixed(2)} kg` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              No carton dimensions on file — contact Jon to pull from supplier
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function QuickLookup() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = trpc.quickLookup.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.trim().length >= 2 }
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick Lookup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search any SKU or description for instant cost, tariff, and carton info.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus
          className="pl-9 h-11 text-base"
          placeholder="Type a SKU code or description... e.g. BDXBT53 or heat pump"
          value={query}
          onChange={handleChange}
        />
      </div>

      {/* Results */}
      {debouncedQuery.trim().length >= 2 && (
        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Searching...
            </div>
          )}

          {!isLoading && results && results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No SKUs found for "{debouncedQuery}"</p>
              <p className="text-sm mt-1">Try a partial SKU code or keyword from the description.</p>
            </div>
          )}

          {!isLoading && results && results.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                {results.length} result{results.length !== 1 ? "s" : ""} — showing top {results.length}
              </p>
              <div className="space-y-3">
                {results.map(item => (
                  <SkuCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {debouncedQuery.trim().length < 2 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-base">Start typing to search</p>
          <p className="text-sm mt-1">Search by SKU code, description, or product group.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["BDXBT", "heat pump", "filter", "pump", "chemical"].map(hint => (
              <button
                key={hint}
                onClick={() => setQuery(hint)}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
