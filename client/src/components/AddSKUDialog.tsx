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

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddSKUDialog({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    sku: "",
    description: "",
    productGroup: "",
    var1: "",
    var2: "",
    status: "active" as const,
    srp2023: "",
    srp2024: "",
    map: "",
    comps2024: "",
    srp2024Amzn: "",
    wholesalePoolCity: "",
    bdWholesaleMarginPct: "",
    fob26Costing: "",
    factoryCost: "",
    pptg25WholesalePrice: "",
    bdWholesaleRetail24: "",
    bdWholesaleRetail25: "",
    adjusted: "",
    landedCost: "",
    landedPlusBdFees: "",
    margin: "",
  });

  const createMutation = trpc.skus.create.useMutation({
    onSuccess: () => {
      toast.success(`SKU ${form.sku} created`);
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!form.sku.trim()) { toast.error("SKU code is required"); return; }
    const nullIfEmpty = (v: string) => v.trim() || null;
    createMutation.mutate({
      sku: {
        sku: form.sku.trim().toUpperCase(),
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
        landedCost: nullIfEmpty(form.landedCost),
        landedPlusBdFees: nullIfEmpty(form.landedPlusBdFees),
        margin: nullIfEmpty(form.margin),
      },
    });
  };

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New SKU</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* SKU Info */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">SKU Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">SKU Code *</Label>
                <Input {...f("sku")} placeholder="e.g. BDXBT53" className="font-mono text-sm uppercase" />
              </div>
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

          {/* Costs */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Costs</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "fob26Costing", label: "FOB 26 Costing" },
                { key: "factoryCost", label: "Factory Cost" },
                { key: "landedCost", label: "Landed Cost" },
                { key: "landedPlusBdFees", label: "Landed + BD Fees" },
                { key: "margin", label: "Margin" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input {...f(key as keyof typeof form)} placeholder="0.00" className="text-sm" type="number" step="0.01" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create SKU
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
