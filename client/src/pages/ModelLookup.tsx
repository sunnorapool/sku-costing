import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Box,
  Package,
  Search,
  Truck,
  Weight,
} from "lucide-react";
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Link } from "wouter";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Val({ v }: { v: string | number | null | undefined }) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  return <span>{String(v)}</span>;
}

function DimRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ModelLookup() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = trpc.skus.list.useQuery(
    { search: debouncedQuery, limit: 12 },
    { enabled: debouncedQuery.trim().length >= 2 }
  );

  const skus = (data?.items ?? []).map(item => item.sku);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Model Lookup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Type a model or SKU code to instantly see carton dimensions, weights, and sourcing info.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 h-11 text-base"
          placeholder="e.g. BDXBT53, Heat Pump, AC45179…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Loading */}
      {isLoading && debouncedQuery.length >= 2 && (
        <p className="text-sm text-muted-foreground animate-pulse">Searching…</p>
      )}

      {/* Empty state */}
      {!isLoading && debouncedQuery.length >= 2 && skus.length === 0 && (
        <p className="text-sm text-muted-foreground">No SKUs found for "{debouncedQuery}".</p>
      )}

      {/* Prompt */}
      {debouncedQuery.length < 2 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Box className="h-12 w-12 opacity-20" />
          <p className="text-sm">Start typing a model number or description above.</p>
        </div>
      )}

      {/* Results grid */}
      {skus.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skus.map(sku => {
            const hasCartonDims = sku.cartonL || sku.cartonW || sku.cartonH;
            const hasWeights = sku.grossWtKg || sku.netWtKg;

            return (
              <Card key={sku.id} className="overflow-hidden">
                <CardHeader className="pb-2 bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/sku/${sku.id}`}>
                        <span className="font-mono font-bold text-primary hover:underline cursor-pointer text-sm">
                          {sku.sku}
                        </span>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sku.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {sku.status && (
                        <Badge
                          variant={sku.status === "active" ? "default" : "secondary"}
                          className="text-[10px] py-0"
                        >
                          {sku.status}
                        </Badge>
                      )}
                      {sku.productGroup && (
                        <span className="text-[10px] text-muted-foreground">{sku.productGroup}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-3 space-y-4">
                  {/* Carton Dimensions */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Box className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Carton Dimensions</span>
                    </div>
                    <DimRow
                      label="L × W × H (cm)"
                      value={
                        hasCartonDims
                          ? `${sku.cartonL ?? "?"} × ${sku.cartonW ?? "?"} × ${sku.cartonH ?? "?"}`
                          : <span className="text-muted-foreground">—</span>
                      }
                    />
                    <DimRow label="Pcs / Carton" value={<Val v={sku.pcsPerCarton} />} />
                    <DimRow label="Packing Type" value={<Val v={sku.packingType} />} />
                  </div>

                  {/* Weights */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Weights</span>
                    </div>
                    <DimRow label="Gross Weight (kg)" value={<Val v={sku.grossWtKg} />} />
                    <DimRow label="Net Weight (kg)" value={<Val v={sku.netWtKg} />} />
                  </div>

                  {/* Sourcing */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sourcing</span>
                    </div>
                    <DimRow label="Supplier" value={<Val v={sku.supplier} />} />
                    <DimRow label="HTS Code" value={
                      sku.htsCode
                        ? <span className="font-mono">{sku.htsCode}</span>
                        : <span className="text-muted-foreground">—</span>
                    } />
                    <DimRow label="Source Status" value={<Val v={sku.sourceStatus} />} />
                  </div>

                  {/* Carton details link */}
                  <div className="pt-1">
                    <Link href={`/sku/${sku.id}`}>
                      <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        View full detail &amp; carton sub-table →
                      </span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Show more hint */}
      {skus.length === 12 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 12 results — refine your search to narrow down.
        </p>
      )}
    </div>
  );
}
