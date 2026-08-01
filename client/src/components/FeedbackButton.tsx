/**
 * FeedbackButton — floating tab pinned to the right edge of every page.
 * Opens a small form to submit a bug, suggestion, question, or general note.
 * Writes to the shared feedback table (also used by Ruben).
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { MessageSquarePlus, X, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type FeedbackType = "bug" | "suggestion" | "question" | "other";

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "🐛 Bug",
  suggestion: "💡 Suggestion",
  question: "❓ Question",
  other: "💬 General note",
};

export function FeedbackButton() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Feedback sent — thanks!");
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setMessage("");
        setName("");
        setType("bug");
      }, 2000);
    },
    onError: () => {
      toast.error("Could not send feedback. Please try again.");
    },
  });

  const pageName = (() => {
    if (location === "/" || location === "") return "sku-catalog";
    return location.replace(/^\//, "").replace(/\//g, "-");
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    submit.mutate({
      testerName: name.trim() || undefined,
      page: pageName,
      type,
      message: message.trim(),
      source: "button",
    });
  }

  return (
    <>
      {/* Floating tab — pinned to right edge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Leave feedback"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2 py-3 rounded-l-lg shadow-lg transition-colors"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" style={{ transform: "rotate(90deg)" }} />
          <span>Feedback</span>
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 w-[320px] bg-background border border-border rounded-l-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-amber-500 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-white" />
                <span className="text-sm font-bold text-white">Leave Feedback</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Close feedback"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              {submitted ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-semibold">Thanks for the feedback!</p>
                  <p className="text-xs text-muted-foreground">We'll look into it.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    Page: <span className="font-medium text-foreground">{pageName}</span>
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Your name (optional)</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="Dan, Chuck, Jon…"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Type</Label>
                    <Select value={type} onValueChange={v => setType(v as FeedbackType)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(TYPE_LABELS) as [FeedbackType, string][]).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">What's on your mind?</Label>
                    <Textarea
                      className="text-sm resize-none"
                      rows={4}
                      placeholder="Describe the issue or idea…"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white border-0"
                    disabled={!message.trim() || submit.isPending}
                  >
                    {submit.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                    ) : (
                      "Send Feedback"
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
