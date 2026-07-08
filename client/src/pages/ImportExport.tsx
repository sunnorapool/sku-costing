import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// ─── CSV Helpers ──────────────────────────────────────────────────────────────
const CSV_HEADERS = [
  "sku",
  "description",
  "productGroup",
  "var1",
  "var2",
  "status",
  "srp2023",
  "srp2024",
  "map",
  "comps2024",
  "srp2024Amzn",
  "wholesalePoolCity",
  "bdWholesaleMarginPct",
  "fob26Costing",
  "factoryCost",
  "pptg25WholesalePrice",
  "bdWholesaleRetail24",
  "bdWholesaleRetail25",
  "adjusted",
  "inc2425Pct",
  "bdMargin",
  "bdMarginPct",
  "landedCost",
  "landedPlusBdFees",
  "margin",
  "srpMargin",
  "tariffPct",
  "tariffAmt",
  "dutyPct",
  "dutyAmt",
  "freight",
  "freightAlt",
  "loadPct",
  "bdLicenseFeePct",
  "asiaMarginPct",
  "bdFee",
  "notes",
  // Sourcing fields
  "supplier",
  "htsCode",
  "sourceStatus",
  "isBd",
  "packingType",
  "pcsPerCarton",
  "cartonL",
  "cartonW",
  "cartonH",
  "grossWtKg",
  "netWtKg",
  "salesQty2024Ytd",
  "avgPrice2024Ytd",
  "salesAmt2024Ytd",
];

const CSV_HEADER_LABELS: Record<string, string> = {
  sku: "SKU",
  description: "Description",
  productGroup: "Product Group",
  var1: "Variant 1",
  var2: "Variant 2",
  status: "Status",
  srp2023: "SRP 2023",
  srp2024: "SRP 2024",
  map: "MAP",
  comps2024: "2024 Comps",
  srp2024Amzn: "SRP 2024 (AMZN)",
  wholesalePoolCity: "Wholesale (Pool City)",
  bdWholesaleMarginPct: "BD Wholesale Margin %",
  fob26Costing: "FOB 26 Costing",
  factoryCost: "Factory Cost",
  pptg25WholesalePrice: "PPTG 25 Wholesale",
  bdWholesaleRetail24: "BD Wholesale Retail 24",
  bdWholesaleRetail25: "BD Wholesale Retail 25",
  adjusted: "Adjusted",
  inc2425Pct: "Inc 24-25%",
  bdMargin: "BD Margin",
  bdMarginPct: "BD Margin %",
  landedCost: "Landed Cost",
  landedPlusBdFees: "Landed + BD Fees",
  margin: "Margin",
  srpMargin: "SRP Margin",
  tariffPct: "Tariff %",
  tariffAmt: "Tariff Amt",
  dutyPct: "Duty %",
  dutyAmt: "Duty Amt",
  freight: "Freight",
  freightAlt: "Freight Alt",
  loadPct: "Load %",
  bdLicenseFeePct: "BD License Fee %",
  asiaMarginPct: "Asia Margin %",
  bdFee: "BD Fee",
  notes: "Notes",
  // Sourcing
  supplier: "Supplier",
  htsCode: "HTS Code",
  sourceStatus: "Source Status",
  isBd: "B&D?",
  packingType: "Packing Type",
  pcsPerCarton: "Pcs/Carton",
  cartonL: "Carton L (cm)",
  cartonW: "Carton W (cm)",
  cartonH: "Carton H (cm)",
  grossWtKg: "Gross Wt (kg)",
  netWtKg: "Net Wt (kg)",
  salesQty2024Ytd: "Sales Qty YTD",
  avgPrice2024Ytd: "Avg Price YTD",
  salesAmt2024Ytd: "Sales Amt YTD",
};

function escapeCSV(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImportExport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const exportQuery = trpc.export.csv.useQuery(undefined, { enabled: false });
  const importMutation = trpc.import.csv.useMutation({
    onSuccess: (result) => {
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated`);
      setImportPreview(null);
    },
    onError: (err) => {
      toast.error(`Import failed: ${err.message}`);
    },
  });

  // ─── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) return;

    const rows = result.data;
    const lines: string[] = [
      CSV_HEADERS.map(h => CSV_HEADER_LABELS[h] ?? h).join(","),
    ];

    for (const row of rows) {
      const sku = row.sku;
      const pricing = row.pricing;
      const line = CSV_HEADERS.map(h => {
        if (h in sku) return escapeCSV((sku as any)[h]);
        if (pricing && h in pricing) return escapeCSV((pricing as any)[h]);
        return "";
      }).join(",");
      lines.push(line);
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sku-costing-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} SKUs`);
  };

  // ─── Import ──────────────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setImportError("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setImportError("CSV must have at least a header row and one data row");
          return;
        }
        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        // Map display headers back to field names
        const reverseMap: Record<string, string> = {};
        for (const [field, label] of Object.entries(CSV_HEADER_LABELS)) {
          reverseMap[label.toLowerCase()] = field;
          reverseMap[field.toLowerCase()] = field;
        }
        const fieldHeaders = headers.map(h => reverseMap[h] ?? h);

        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          fieldHeaders.forEach((field, idx) => {
            if (field && values[idx] !== undefined) {
              row[field] = values[idx].trim();
            }
          });
          if (row.sku) rows.push(row);
        }

        if (rows.length === 0) {
          setImportError("No valid rows found (each row must have a SKU value)");
          return;
        }

        setImportError(null);
        setImportPreview(rows);
      } catch (err) {
        setImportError("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImportConfirm = () => {
    if (!importPreview) return;
    const rows = importPreview.map(row => ({
      sku: row.sku,
      description: row.description || undefined,
      productGroup: row.productGroup || undefined,
      var1: row.var1 || undefined,
      var2: row.var2 || undefined,
      status: (row.status as any) || undefined,
      srp2023: row.srp2023 || undefined,
      srp2024: row.srp2024 || undefined,
      map: row.map || undefined,
      comps2024: row.comps2024 || undefined,
      srp2024Amzn: row.srp2024Amzn || undefined,
      wholesalePoolCity: row.wholesalePoolCity || undefined,
      bdWholesaleMarginPct: row.bdWholesaleMarginPct || undefined,
      fob26Costing: row.fob26Costing || undefined,
      factoryCost: row.factoryCost || undefined,
      pptg25WholesalePrice: row.pptg25WholesalePrice || undefined,
      bdWholesaleRetail24: row.bdWholesaleRetail24 || undefined,
      bdWholesaleRetail25: row.bdWholesaleRetail25 || undefined,
      adjusted: row.adjusted || undefined,
      landedCost: row.landedCost || undefined,
      landedPlusBdFees: row.landedPlusBdFees || undefined,
      margin: row.margin || undefined,
    }));
    importMutation.mutate({ rows });
  };

  // ─── Template Download ────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const csv = [
      CSV_HEADERS.map(h => CSV_HEADER_LABELS[h] ?? h).join(","),
      "BDXBT53,53K BTU Heat Pump,Heat Pumps,53K BTU,Standard Cord,active,2499.00,2699.00,2499.00,,,,0.25,800.00,650.00,,1800.00,1900.00,,,,,,,,,,0.056,,,,,,,,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sku-costing-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Import / Export
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Export all SKU costing data to CSV, or import from a spreadsheet.
        </p>
      </div>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download all SKU costing data as a CSV file. This includes all pricing fields, costs, margins, tariffs, and notes.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleExport} disabled={exportQuery.isFetching}>
              {exportQuery.isFetching ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" />Export All SKUs to CSV</>
              )}
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to import or update SKU data. Existing SKUs (matched by SKU code) will be updated; new SKUs will be created.
            </p>

            {!importPreview ? (
              <>
                {/* Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop your CSV file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>

                {importError && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    {importError}
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">CSV Format Requirements:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>First row must be a header row</li>
                    <li>Column "SKU" is required; all other columns are optional</li>
                    <li>Download the template above to see the exact column format</li>
                    <li>Percentage fields should be decimals (e.g. 0.25 for 25%)</li>
                  </ul>
                </div>
              </>
            ) : (
              /* Preview */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {importPreview.length} rows ready to import
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setImportPreview(null)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>

                {/* Preview Table */}
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">SKU</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Description</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Product Group</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">SRP 2024</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">MAP</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">FOB 26</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Landed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-mono font-medium">{row.sku}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{row.description ?? "—"}</td>
                          <td className="px-3 py-2">{row.productGroup ?? "—"}</td>
                          <td className="px-3 py-2 text-right">{row.srp2024 ? `$${row.srp2024}` : "—"}</td>
                          <td className="px-3 py-2 text-right">{row.map ? `$${row.map}` : "—"}</td>
                          <td className="px-3 py-2 text-right">{row.fob26Costing ? `$${row.fob26Costing}` : "—"}</td>
                          <td className="px-3 py-2 text-right">{row.landedCost ? `$${row.landedCost}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 20 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground border-t bg-muted/20">
                      ... and {importPreview.length - 20} more rows
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleImportConfirm}
                    disabled={importMutation.isPending}
                    className="flex-1"
                  >
                    {importMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />Confirm Import ({importPreview.length} rows)</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setImportPreview(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
      </Card>

      {/* Column Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Column Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {CSV_HEADERS.map(h => (
              <div key={h} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{h}</span>
                <span className="text-muted-foreground">{CSV_HEADER_LABELS[h]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
