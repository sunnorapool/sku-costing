import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRODUCT_GROUPS = [
  "Heat Pumps",
  "Above-Ground Pumps",
  "In-Ground Pumps",
  "Sand Filters",
  "Hose Kits",
  "Filter Tanks",
  "Other",
];

type SkuRow = {
  sku: {
    id: number;
    sku: string;
    description: string | null;
    productGroup: string | null;
    var1: string | null;
    var2: string | null;
    status: "active" | "done" | "new_model" | "missing" | "discontinued";
    sortOrder: number | null;
    createdAt: Date;
    updatedAt: Date;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pricing: any | null;
};

type Props = {
  open: boolean;
  sku: SkuRow;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditSKUDialog({ open, sku, onClose, onSaved }: Props) {
  const s = sku.sku;
  const p = sku.pricing ?? {};

  const [form, setForm] = useState({
    description: s.description ?? "",
    productGroup: s.productGroup ?? "",
    var1: s.var1 ?? "",
    var2: s.var2 ?? "",
    status: s.status,
    // Pricing
    srp2023: p.srp2023 ?? "",
    srp2024: p.srp2024 ?? "",
    map: p.map ?? "",
    comps2024: p.comps2024 ?? "",
    srp2024Amzn: p.srp2024Amzn ?? "",
    wholesalePoolCity: p.wholesalePoolCity ?? "",
    bdWholesaleMarginPct: p.bdWholesaleMarginPct ?? "",
    bdWholesaleRetail24: p.bdWholesaleRetail24 ?? "",
    bdWholesaleRetail25: p.bdWholesaleRetail25 ?? "",
    adjusted: p.adjusted ?? "",
    pptg25WholesalePrice: p.pptg25WholesalePrice ?? "",
    // Costs & Margins
    fob26Costing: p.fob26Costing ?? "",
    factoryCost: p.factoryCost ?? "",
    landedCost: p.landedCost ?? "",
    landedPlusBdFees: p.landedPlusBdFees ?? "",
    bdMargin: p.bdMargin ?? "",
    bdMarginPct: p.bdMarginPct ?? "",
    inc2425Pct: p.inc2425Pct ?? "",
    margin: p.margin ?? "",
    srpMargin: p.srpMargin ?? "",
    // Tariffs & Duties
    tariffPct: p.tariffPct ?? "",
    tariffAmt: p.tariffAmt ?? "",
    dutyPct: p.dutyPct ?? "",
    dutyAmt: p.dutyAmt ?? "",
    // Freight & Fees
    freight: p.freight ?? "",
    freightAlt: p.freightAlt ?? "",
    loadPct: p.loadPct ?? "",
    bdLicenseFeePct: p.bdLicenseFeePct ?? "",
    asiaMarginPct: p.asiaMarginPct ?? "",
    bdFee: p.bdFee ?? "",
    // Notes
    notes: p.notes ?? "",
  });

  const updateMutation = trpc.skus.update.useMutation({
    onSuccess: () => {
      toast.success(`SKU ${s.sku} updated`);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const nullIfEmpty = (v: string) => v.trim() || null;
    updateMutation.mutate({
      id: s.id,
      sku: {
        description: nullIfEmpty(form.description),
        productGroup: nullIfEmpty(form.productGroup),
        var1: nullIfEmpty(form.var1),
        var2: nullIfEmpty(form.var2),
        status: form.status,
      },
      pricing: {
        srp2023: nullIfEmpty(form.srp2023),
        srp2024: nullIfEmpty(form.srp2024),
        map: nullIfEmpty(form.map),
        comps2024: nullIfEmpty(form.comps2024),
        srp2024Amzn: nullIfEmpty(form.srp2024Amzn),
        wholesalePoolCity: nullIfEmpty(form.wholesalePoolCity),
        bdWholesaleMarginPct: nullIfEmpty(form.bdWholesaleMarginPct),
        fob26Costing: nullIfEmpty(form.fob26Costing),
        factoryCost: nullIfEmpty(form.factoryCost),
        pptg25WholesalePrice: nullIfEmpty(form.pptg25WholesalePrice),
        bdWholesaleRetail24: nullIfEmpty(form.bdWholesaleRetail24),
        bdWholesaleRetail25: nullIfEmpty(form.bdWholesaleRetail25),
        adjusted: nullIfEmpty(form.adjusted),
        inc2425Pct: nullIfEmpty(form.inc2425Pct),
        bdMargin: nullIfEmpty(form.bdMargin),
        bdMarginPct: nullIfEmpty(form.bdMarginPct),
        landedCost: nullIfEmpty(form.landedCost),
        landedPlusBdFees: nullIfEmpty(form.landedPlusBdFees),
        margin: nullIfEmpty(form.margin),
        srpMargin: nullIfEmpty(form.srpMargin),
        tariffPct: nullIfEmpty(form.tariffPct),
        tariffAmt: nullIfEmpty(form.tariffAmt),
        dutyPct: nullIfEmpty(form.dutyPct),
        dutyAmt: nullIfEmpty(form.dutyAmt),
        freight: nullIfEmpty(form.freight),
        freightAlt: nullIfEmpty(form.freightAlt),
        loadPct: nullIfEmpty(form.loadPct),
        bdLicenseFeePct: nullIfEmpty(form.bdLicenseFeePct),
        asiaMarginPct: nullIfEmpty(form.asiaMarginPct),
        bdFee: nullIfEmpty(form.bdFee),
        notes: nullIfEmpty(form.notes),
      } as any,
    });
  };

  const f = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit SKU: <span className="font-mono text-primary">{s.sku}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* SKU Info */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">SKU Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea {...f("description")} placeholder="Full product description" rows={2} className="text-sm resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Product Group</Label>
                <Select value={form.productGroup || "_none"} onValueChange={v => setForm(p => ({ ...p, productGroup: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {PRODUCT_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as any }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="new_model">New Model</SelectItem>
                    <SelectItem value="missing">Missing</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Variant 1</Label>
                <Input {...f("var1")} placeholder="e.g. 53K BTU" className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Variant 2</Label>
                <Input {...f("var2")} placeholder="e.g. Standard Cord" className="text-sm" />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pricing</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "srp2023", label: "SRP 2023" },
                { key: "srp2024", label: "SRP 2024" },
                { key: "map", label: "MAP" },
                { key: "comps2024", label: "2024 Comps" },
                { key: "srp2024Amzn", label: "SRP 2024 (AMZN)" },
                { key: "wholesalePoolCity", label: "Wholesale (Pool City)" },
                { key: "bdWholesaleMarginPct", label: "BD Wholesale Margin %" },
                { key: "bdWholesaleRetail24", label: "BD Wholesale Retail 24" },
                { key: "bdWholesaleRetail25", label: "BD Wholesale Retail 25" },
                { key: "adjusted", label: "Adjusted" },
                { key: "pptg25WholesalePrice", label: "PPTG 25 Wholesale" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input {...f(key as keyof typeof form)} placeholder="0.00" className="text-sm" type="number" step="0.01" />
                </div>
              ))}
            </div>
          </div>

          {/* Costs & Margins */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Costs & Margins</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "fob26Costing", label: "FOB 26 Costing" },
                { key: "factoryCost", label: "Factory Cost" },
                { key: "landedCost", label: "Landed Cost" },
                { key: "landedPlusBdFees", label: "Landed + BD Fees" },
                { key: "bdMargin", label: "BD Margin" },
                { key: "bdMarginPct", label: "BD Margin %" },
                { key: "inc2425Pct", label: "Inc 24-25%" },
                { key: "margin", label: "Margin" },
                { key: "srpMargin", label: "SRP Margin" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input {...f(key as keyof typeof form)} placeholder="0.00" className="text-sm" type="number" step="0.0001" />
                </div>
              ))}
            </div>
          </div>

          {/* Tariffs & Duties */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tariffs & Duties</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "tariffPct", label: "Tariff %" },
                { key: "tariffAmt", label: "Tariff Amount" },
                { key: "dutyPct", label: "Duty %" },
                { key: "dutyAmt", label: "Duty Amount" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input {...f(key as keyof typeof form)} placeholder="0.00" className="text-sm" type="number" step="0.0001" />
                </div>
              ))}
            </div>
          </div>

          {/* Freight & Fees */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Freight & Fees</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "freight", label: "Freight" },
                { key: "freightAlt", label: "Freight Alt" },
                { key: "loadPct", label: "Load %" },
                { key: "bdLicenseFeePct", label: "BD License Fee %" },
                { key: "asiaMarginPct", label: "Asia Margin %" },
                { key: "bdFee", label: "BD Fee" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input {...f(key as keyof typeof form)} placeholder="0.00" className="text-sm" type="number" step="0.0001" />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notes</h3>
            <Textarea {...f("notes")} placeholder="Internal notes about this SKU..." rows={3} className="text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
