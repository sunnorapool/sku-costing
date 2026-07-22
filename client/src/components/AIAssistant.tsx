/**
 * Ruben — Global AI Assistant
 *
 * A floating chat button (bottom-right) that opens a panel.
 * - On mobile: full-screen overlay so close button is always reachable
 * - On desktop: 380px wide slide-up panel
 * - Greets the user with "Hi, I'm Ruben…" on first open
 * - Context-aware, conversational, actionable
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Loader2, Send, Sparkles, X } from "lucide-react";
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

// ─── Greeting message ─────────────────────────────────────────────────────────

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi, I'm Ruben! I'm here to help with anything in the app — pricing questions, formula explanations, looking up a SKU or dealer, or making changes to settings. What do you need?",
};

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={j} className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">
            {part.slice(1, -1)}
          </code>
        );
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
  const isLoading =
    updateFreight.isPending || updateMargin.isPending || updateTier.isPending || updateCustomer.isPending;

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
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <Sparkles className="h-3 w-3 mr-1" />
      )}
      {action.label}
    </Button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onActionApplied }: { msg: ChatMessage; onActionApplied: () => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && (
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-white">R</span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">Ruben</span>
        </div>
      )}
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

// ─── Ruben avatar button ──────────────────────────────────────────────────────

function RubenAvatar({ onClick, hasUnread }: { onClick: () => void; hasUnread: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open Ruben AI assistant"
      className="fixed bottom-5 right-5 z-50 group flex items-center gap-2"
    >
      {/* Pulse ring */}
      {hasUnread && (
        <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-30 pointer-events-none" />
      )}
      {/* Label bubble — visible on hover on desktop, always visible on first open */}
      <span className="hidden sm:flex items-center bg-background border shadow-md rounded-full px-3 py-1.5 text-xs font-medium text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap mr-1 pointer-events-none">
        Ask Ruben
      </span>
      {/* Avatar circle */}
      <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
        <span className="text-xl font-bold text-white select-none">R</span>
        {hasUnread && (
          <span className="absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-green-400 border-2 border-background" />
        )}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIAssistant() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [hasUnread, setHasUnread] = useState(true); // show indicator until first open
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = trpc.aiAssistant.chat.useMutation();

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
    if (open) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || chat.isPending) return;
    setInput("");

    // Build messages excluding the greeting for API (it's just UI)
    const conversationMessages: ChatMessage[] = [
      ...messages.filter(m => !(m === GREETING)),
      { role: "user", content: text },
    ];
    setMessages([...messages, { role: "user", content: text }]);

    try {
      const result = await chat.mutateAsync({
        messages: conversationMessages.map(m => ({ role: m.role, content: m.content })),
        page: pageName,
      });
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: result.content, actions: result.actions as Action[] },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
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
    setMessages([GREETING]);
  }

  const suggestions = [
    "Why is BDXBT53 showing BLOCKED?",
    "How is the landed cost calculated?",
    "What's UAG's tier level?",
    "Set the import margin to 32%",
  ];

  const hasConversation = messages.length > 1;

  return (
    <>
      {/* Floating Ruben button — hidden when panel is open */}
      {!open && <RubenAvatar onClick={() => setOpen(true)} hasUnread={hasUnread} />}

      {/* Chat panel */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Panel — full screen on mobile, fixed card on desktop */}
          <div
            className={[
              "fixed z-50 bg-background flex flex-col overflow-hidden",
              // Mobile: full screen
              "inset-0 sm:inset-auto",
              // Desktop: bottom-right card
              "sm:bottom-5 sm:right-5 sm:w-[390px] sm:rounded-2xl sm:border sm:shadow-2xl",
              // Height
              "sm:h-[560px]",
            ].join(" ")}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-indigo-600 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-base font-bold text-white">R</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-none">Ruben</p>
                  <p className="text-[11px] text-blue-100 mt-0.5 leading-none">
                    AI Assistant · {pageName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {hasConversation && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[11px] text-white/80 hover:text-white hover:bg-white/10"
                    onClick={clearChat}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                  onClick={() => setOpen(false)}
                  aria-label="Close Ruben"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="flex flex-col gap-3 pb-2">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} onActionApplied={() => {}} />
                ))}

                {/* Suggestion chips — show after greeting only */}
                {!hasConversation && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        className="text-left text-xs px-3 py-2.5 rounded-xl border hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setInput(s);
                          inputRef.current?.focus();
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {chat.isPending && (
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-white">R</span>
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-[13px] text-muted-foreground">Ruben is thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="px-3 pb-4 pt-2 border-t bg-muted/10 shrink-0">
              <div className="flex gap-2 items-center">
                <Input
                  ref={inputRef}
                  className="flex-1 h-10 text-sm rounded-xl bg-background"
                  placeholder="Ask Ruben anything…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={chat.isPending}
                />
                <Button
                  size="sm"
                  className="h-10 w-10 p-0 rounded-xl shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0"
                  onClick={sendMessage}
                  disabled={!input.trim() || chat.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
                Ruben has access to your live pricing data
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
