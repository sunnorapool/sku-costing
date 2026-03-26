import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  FileUp,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  User,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type VersionEntry = {
  id: number;
  skuId: number;
  userId: number | null;
  changeType: "create" | "update" | "delete" | "ai_prompt" | "import" | "revert";
  changeDescription: string | null;
  promptText: string | null;
  previousData: unknown;
  newData: unknown;
  affectedSkuIds: unknown;
  createdAt: Date;
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  ai_prompt: "AI Prompt",
  import: "Imported",
  revert: "Reverted",
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700 border-emerald-200",
  update: "bg-blue-50 text-blue-700 border-blue-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  ai_prompt: "bg-purple-50 text-purple-700 border-purple-200",
  import: "bg-amber-50 text-amber-700 border-amber-200",
  revert: "bg-gray-50 text-gray-600 border-gray-200",
};

import React from "react";

const CHANGE_TYPE_ICONS: Record<string, React.ReactElement> = {
  create: <Pencil className="h-3.5 w-3.5" />,
  update: <Pencil className="h-3.5 w-3.5" />,
  delete: <Trash2 className="h-3.5 w-3.5" />,
  ai_prompt: <Sparkles className="h-3.5 w-3.5" />,
  import: <FileUp className="h-3.5 w-3.5" />,
  revert: <RotateCcw className="h-3.5 w-3.5" />,
};

function formatDate(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function DataDiff({ prev, next }: { prev: Record<string, unknown>; next: Record<string, unknown> }) {
  if (!prev && !next) return null;

  const prevObj = prev ?? {};
  const nextObj = next ?? {};

  const allKeys = Array.from(new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]));
  const changedKeys = allKeys.filter(k => {
    const pv = prevObj[k];
    const nv = nextObj[k];
    return pv !== nv && (pv !== null || nv !== null);
  });

  if (changedKeys.length === 0) return <p className="text-xs text-muted-foreground">No field changes recorded.</p>;

  const FIELD_LABELS: Record<string, string> = {
    srp2023: "SRP 2023", srp2024: "SRP 2024", map: "MAP", comps2024: "2024 Comps",
    srp2024Amzn: "SRP 2024 (AMZN)", wholesalePoolCity: "Wholesale (Pool City)",
    bdWholesaleMarginPct: "BD Wholesale Margin %", fob26Costing: "FOB 26 Costing",
    factoryCost: "Factory Cost", pptg25WholesalePrice: "PPTG 25 Wholesale",
    bdWholesaleRetail24: "BD Wholesale Retail 24", bdWholesaleRetail25: "BD Wholesale Retail 25",
    adjusted: "Adjusted", inc2425Pct: "Inc 24-25%", bdMargin: "BD Margin",
    bdMarginPct: "BD Margin %", landedCost: "Landed Cost", landedPlusBdFees: "Landed + BD Fees",
    margin: "Margin", description: "Description", productGroup: "Product Group",
    var1: "Variant 1", var2: "Variant 2", status: "Status",
  };

  return (
    <table className="w-full text-xs mt-2">
      <thead>
        <tr className="border-b">
          <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground w-1/3">Field</th>
          <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground w-1/3">Previous</th>
          <th className="text-left py-1.5 font-semibold text-muted-foreground w-1/3">New</th>
        </tr>
      </thead>
      <tbody>
        {changedKeys.map(k => (
          <tr key={k} className="border-b last:border-0">
            <td className="py-1.5 pr-3 font-medium">{FIELD_LABELS[k] ?? k}</td>
            <td className="py-1.5 pr-3 text-red-500 line-through">{String(prevObj[k] ?? "—")}</td>
            <td className="py-1.5 text-emerald-600 font-medium">{String(nextObj[k] ?? "—")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VersionCard({ entry, isAdmin, onRevert }: {
  entry: VersionEntry;
  isAdmin: boolean;
  onRevert: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasData = Boolean(entry.previousData || entry.newData);

  return (
    <div className="border rounded-lg overflow-hidden hover:border-primary/30 transition-colors">
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Icon */}
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${CHANGE_TYPE_COLORS[entry.changeType]}`}>
          {CHANGE_TYPE_ICONS[entry.changeType]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${CHANGE_TYPE_COLORS[entry.changeType]}`}>
              {CHANGE_TYPE_LABELS[entry.changeType]}
            </span>
            <span className="text-sm font-medium text-foreground truncate">
              {entry.changeDescription ?? "No description"}
            </span>
          </div>

          {entry.promptText && (
            <p className="text-xs text-muted-foreground mt-1 italic truncate">
              "{entry.promptText}"
            </p>
          )}

          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(entry.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {entry.userId ? `User #${entry.userId}` : "System / AI"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && entry.changeType !== "delete" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs hover:bg-amber-50 hover:text-amber-700"
              onClick={e => { e.stopPropagation(); onRevert(entry.id); }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Revert
            </Button>
          )}
          {Boolean(hasData) && Boolean(expanded) && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          {Boolean(hasData) && !expanded && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded diff */}
      {Boolean(expanded) && Boolean(hasData) && (
        <div className="border-t bg-muted/10 px-4 py-3">
          <DataDiff prev={(entry.previousData ?? {}) as Record<string, unknown>} next={(entry.newData ?? {}) as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}

export default function VersionHistory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [changeTypeFilter, setChangeTypeFilter] = useState("");
  const [revertConfirm, setRevertConfirm] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.versions.list.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const revertMutation = trpc.versions.revert.useMutation({
    onSuccess: () => {
      toast.success("Successfully reverted to previous state");
      setRevertConfirm(null);
      utils.skus.list.invalidate();
      utils.versions.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rawEntries = data?.items ?? [];
  const entries: VersionEntry[] = rawEntries
    .map((r: any) => (r.version ? { ...r.version, userName: r.user?.name ?? null } : r))
    .filter((e: any) => {
      if (search && !(
        (e.changeDescription ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.promptText ?? "").toLowerCase().includes(search.toLowerCase())
      )) return false;
      if (changeTypeFilter && e.changeType !== changeTypeFilter) return false;
      return true;
    }) as VersionEntry[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <History className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Version History</h1>
          <p className="text-xs text-muted-foreground">Track all changes made to SKU pricing data over time</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto h-8" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search descriptions or prompts..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {["", "create", "update", "delete", "ai_prompt", "import", "revert"].map(type => (
            <button
              key={type}
              onClick={() => { setChangeTypeFilter(type); setPage(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                changeTypeFilter === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {type === "" ? "All" : CHANGE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="text-xs text-muted-foreground">
        {total.toLocaleString()} change{total !== 1 ? "s" : ""} recorded
        {(search || changeTypeFilter) && " · Filtered"}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground border rounded-xl">
          <History className="h-10 w-10 opacity-20" />
          <p className="text-sm">No version history yet</p>
          <p className="text-xs">Changes to SKU data will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map(entry => (
            <VersionCard
              key={entry.id}
              entry={entry}
              isAdmin={isAdmin}
              onRevert={id => setRevertConfirm(id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Revert Confirm Dialog */}
      <Dialog open={!!revertConfirm} onOpenChange={() => setRevertConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Revert to Previous State
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will restore the SKU data to its state before this change was made. The current data will be overwritten. A new version entry will be created to track this revert.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertConfirm(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={revertMutation.isPending}
              onClick={() => revertConfirm && revertMutation.mutate({ versionId: revertConfirm })}
            >
              {revertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Confirm Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
