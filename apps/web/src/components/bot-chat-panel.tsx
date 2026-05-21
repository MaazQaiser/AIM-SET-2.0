"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Lock, Send, Users } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BotChatSuggestedActions } from "@/components/bot-chat/bot-chat-suggested-actions";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { CitationMarker } from "@/components/citation-marker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  buildSuggestedActions,
  checklistBantPct,
  type SuggestedActionsContext,
} from "@/lib/bot-chat/suggested-actions";
import { podDisplayForRole } from "@/lib/bot-chat/pod-display";
import type { BotChatMessage, BotChatMode, BotChatPhase, SuggestedAction } from "@/lib/bot-chat/types";
import { useBotChatStore } from "@/stores/use-bot-chat";
import { usePersona } from "@/hooks/use-persona";
import type { CallBrief } from "@/lib/brief-types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { Citation, PodRole } from "@/types";

interface BotChatPanelProps {
  callId: string;
  className?: string;
  phase?: BotChatPhase;
  accountName?: string;
  brief?: CallBrief | null;
  /** Live-call context (optional in prep phase) */
  intentLabel?: string;
  painCount?: number;
  checklist?: DiscoveryChecklistState | null;
  transcriptLineCount?: number;
  hasObjections?: boolean;
}

function authorBadge(msg: BotChatMessage) {
  if (msg.role === "assistant") {
    return (
      <span className="text-[10px] font-semibold text-primary flex items-center gap-1 mb-1">
        <Bot className="h-3 w-3" aria-hidden />
        DC Copilot
      </span>
    );
  }
  if (msg.role === "system") return null;
  return (
    <span className="text-[10px] font-medium text-muted-foreground mb-1 block">
      {msg.authorName}
      {msg.authorRole ? ` · ${msg.authorRole.toUpperCase()}` : ""}
      {msg.isPrivate && (
        <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground/80">
          <Lock className="h-2.5 w-2.5" aria-hidden />
          private
        </span>
      )}
    </span>
  );
}

export function BotChatPanel({
  callId,
  className,
  phase = "live",
  accountName,
  brief,
  intentLabel,
  painCount = 0,
  checklist,
  transcriptLineCount = 0,
  hasObjections = false,
}: BotChatPanelProps) {
  const persona = usePersona();
  const viewerRole: PodRole | "leadership" =
    persona === "leadership" || persona === "content-owner" ? "leadership" : persona;
  const podMember = podDisplayForRole(viewerRole);

  const mode = useBotChatStore((s) => s.getMode(callId));
  const setMode = useBotChatStore((s) => s.setMode);
  const messages = useBotChatStore((s) => s.getMessages(callId, mode));
  const appendMessage = useBotChatStore((s) => s.appendMessage);
  const seedGroupWelcome = useBotChatStore((s) => s.seedGroupWelcome);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    if (mode === "group") seedGroupWelcome(callId, accountName);
  }, [callId, accountName, mode, seedGroupWelcome]);

  const suggestedCtx: SuggestedActionsContext = useMemo(
    () => ({
      phase,
      persona: viewerRole,
      accountName,
      brief,
      intentLabel,
      painCount,
      openGaps: checklist?.openGaps,
      bantCoveragePct: checklistBantPct(checklist ?? null),
      transcriptLineCount,
      hasObjections,
    }),
    [
      phase,
      viewerRole,
      accountName,
      brief,
      intentLabel,
      painCount,
      checklist,
      transcriptLineCount,
      hasObjections,
    ]
  );

  const suggestedActions = useMemo(
    () => buildSuggestedActions(suggestedCtx),
    [suggestedCtx]
  );

  useEffect(() => {
    if (!userScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: BotChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        authorName: podMember.name,
        authorRole: viewerRole === "leadership" ? "ae" : viewerRole,
        authorInitials: podMember.initials,
        createdAt: Date.now(),
        isPrivate: mode === "direct",
      };

      appendMessage(callId, mode, userMessage);
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/calls/${callId}/bot-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            mode,
            sender_name: podMember.name,
            sender_role: viewerRole === "leadership" ? "ae" : viewerRole,
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Bot chat is not available");
        }

        const data = (await res.json()) as {
          content: string;
          citations?: Citation[];
          message_id?: string;
        };

        appendMessage(callId, mode, {
          id: data.message_id ?? crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          citations: data.citations,
          authorName: "DC Copilot",
          createdAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsLoading(false);
      }
    },
    [callId, mode, isLoading, appendMessage, podMember, viewerRole]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage(input);
  }

  function handleSuggestedAction(action: SuggestedAction) {
    void sendMessage(action.prompt);
  }

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-card", className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
        <Bot className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <span className="text-sm font-medium truncate">DC Copilot</span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <div
            className="inline-flex rounded-md border border-border p-0.5 bg-muted/30"
            role="tablist"
            aria-label="Chat mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "group"}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                mode === "group"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode(callId, "group")}
            >
              <Users className="h-3 w-3" aria-hidden />
              Pod
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "direct"}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                mode === "direct"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode(callId, "direct")}
            >
              <Lock className="h-3 w-3" aria-hidden />
              Direct
            </button>
          </div>
          <AIGeneratedBadge />
        </div>
      </div>

      {mode === "group" ? (
        <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border/60 shrink-0">
          Shared with everyone on this call. Copilot replies appear for the whole pod.
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border/60 shrink-0">
          Private to you — teammates do not see direct messages or replies.
        </p>
      )}

      <BotChatSuggestedActions
        actions={suggestedActions}
        onSelect={handleSuggestedAction}
        disabled={isLoading}
      />

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
        onScroll={() => {
          const el = listRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          userScrolledRef.current = !atBottom;
        }}
      >
        {messages.length === 0 && !error && mode === "direct" && (
          <p className="text-sm text-muted-foreground text-center py-6 px-2">
            Ask DC Copilot privately about this call — prep questions, talk tracks, or live coaching.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3">
            {error}
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
              msg.role === "system" && "justify-center"
            )}
          >
            <div
              className={cn(
                "max-w-[92%] rounded-lg px-3 py-2 text-sm min-w-0",
                msg.role === "user" && "bg-primary text-primary-foreground",
                msg.role === "assistant" && "bg-muted text-foreground border border-border/60",
                msg.role === "system" &&
                  "bg-muted/40 text-muted-foreground text-xs text-center border border-dashed border-border max-w-full"
              )}
            >
              {authorBadge(msg)}
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.citations.map((c, i) => (
                        <CitationMarker key={c.id ?? i} index={i + 1} citation={c} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="whitespace-pre-wrap break-words">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <Badge variant="secondary" className="text-[10px] animate-pulse">
              DC Copilot is thinking…
            </Badge>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2 shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "group"
              ? "Message the pod or ask Copilot…"
              : "Private question for Copilot…"
          }
          disabled={isLoading}
          className="flex-1 text-sm"
          aria-label={mode === "group" ? "Pod group message" : "Direct message to Copilot"}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
