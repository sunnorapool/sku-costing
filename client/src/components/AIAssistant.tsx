/**
 * Global AI Assistant Panel
 *
 * A floating chat button (bottom-right) that opens a slide-up drawer.
 * Available on every page via DashboardLayout.
 * - Context-aware: passes the current page name to the backend
 * - Conversational: maintains message history for the session
 * - Actionable: AI can propose changes with a confirm button
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Bot, ChevronDown, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: Action[];
}

interface Action {
  type: string;
  label: string;
  [key: string]: unknown;
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
// Renders **bold**, `code`, and newlines without a full markdown library

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={j} className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
      }
      return <span key={j}>{part}</span>;
    });
    return (
      <span key={i}>
        {rendered}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ─── Action confirm button ────────────────────────────────────────────────────

function ActionButton({ action, onApplied }: { action: Action; onApplied: () => void }) {
  const utils = trpc.useUtils();

  const updateFreight = trpc.supplySide["freightConfig.update"].useMutation({
    onSuccess: () => { utils.supplySide["freightConfig.get"].invalidate(); onApplied(); },
  });
  const updateMargin = trpc.dealerPricing.updateMarginRule.useMutation({
    onSuccess: () => { utils.dealerPricing.getAssumptions.invalidate(); onApplied(); },
  });
  const updateTier = trpc.dealerPricing.updateTierDiscount.useMutation({
    onSuccess: () => { utils.dealerPricing.getAssumptions.invalidate(); onApplied(); },
  });
  const updateCustomer = trpc.dealerPricing.upsertCustomer.useMutation({
    onSuccess: () => { utils.dealerPricing.getCustomers.invalidate(); onApplied(); },
  });

  const [applied, setApplied] = useState(false);
  const isLoading = updateFreight.isPending || updateMargin.isPending || updateTier.isPending || updateCustomer.isPending;

  function apply() {
    if (action.type === "setFreightConfig") {
      updateFreight.mutate({ key: action.key as string, value: action.value as string });
    } else if (action.type === "setMarginRule") {
      updateMargin.mutate({
        scope: action.scope as "global" | "category" | "vendor" | "sku",
        scopeValue: action.scopeValue as string | null,
        importMarginPct: action.importMarginPct as number | null,
        domesticMarginPct: action.domesticMarginPct as number | null,
      });
    } else if (action.type === "setTierDiscount") {
      updateTier.mutate({ tier: action.tier as number, discountPct: action.discountPct as number });
    } else if (action.type === "setCustomerTier") {
      updateCustomer.mutate({
        id: action.customerId as number,
        name: action.customerName as string,
        tier: action.tier as number,
        notes: null,
      });
    } else {
      toast.info("This action type requires manual configuration in the app settings.");
      return;
    }
    setApplied(true);
    toast.success(`Applied: ${action.label}`);
  }

  if (applied) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium">
        ✓ Applied
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-[11px] px-2.5 border-primary/40 text-primary hover:bg-primary/10"
      onClick={apply}
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
      {action.label}
    </Button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onActionApplied }: { msg: ChatMessage; onActionApplied: () => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {renderContent(msg.content)}
      </div>
      {msg.actions && msg.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-[85%]">
          {msg.actions.map((action, i) => (
            <ActionButton key={i} action={action} onApplied={onActionApplied} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIAssistant() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = trpc.aiAssistant.chat.useMutation();

  // Derive a human-readable page name from the route
  const pageName = (() => {
    if (location === "/" || location === "") return "sku-catalog";
    return location.replace(/^\//, "").replace(/\//g, "-");
  })();

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chat.isPending]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || chat.isPending) return;
    setInput("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);

    try {
      const result = await chat.mutateAsync({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        page: pageName,
      });
      setMessages([
        ...newMessages,
        { role: "assistant", content: result.content, actions: result.actions as Action[] },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Sorry, I ran into an error. Please try again." },
      ]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([]);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        aria-label="Open AI assistant"
      >
        {open ? <ChevronDown className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">AI Assistant</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                  Ask anything about the app
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={clearChat}>
                  Clear
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">How can I help?</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[260px]">
                    Ask me anything — how a formula works, what a field means, how to make a change, or to look up a SKU or dealer.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full mt-1">
                  {[
                    "Why is BDXBT53 showing BLOCKED?",
                    "How is the landed cost calculated?",
                    "What's UAG's tier level?",
                    "Set the import margin to 32%",
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      className="text-left text-xs px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} onActionApplied={() => {}} />
                ))}
                {chat.isPending && (
                  <div className="flex items-start gap-2">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-[13px] text-muted-foreground">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Page context badge */}
          <div className="px-4 pb-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground/60 border-muted-foreground/20">
              Context: {pageName}
            </Badge>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1 border-t bg-muted/10">
            <div className="flex gap-2 items-center">
              <Input
                ref={inputRef}
                className="flex-1 h-9 text-sm rounded-xl bg-background"
                placeholder="Ask a question or request a change…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chat.isPending}
              />
              <Button
                size="sm"
                className="h-9 w-9 p-0 rounded-xl shrink-0"
                onClick={sendMessage}
                disabled={!input.trim() || chat.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
