"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Send } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { usePersona } from "@/hooks/use-persona";
import { podDisplayForRole } from "@/lib/bot-chat/pod-display";
import type { BotChatMessage } from "@/lib/bot-chat/types";
import type { Citation, PodRole } from "@/types";
import { liveColumnHorizontalPadding } from "@/components/live/live-column-header";
import { cn } from "@/lib/cn";
import { EMPTY_BOT_CHAT_MESSAGES, useBotChatStore } from "@/stores/use-bot-chat";

const CHAT_MODE = "direct" as const;

type LiveCopilotChatContextValue = {
  threadMessages: BotChatMessage[];
  isLoading: boolean;
  error: string | null;
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (e: FormEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

const LiveCopilotChatContext = createContext<LiveCopilotChatContextValue | null>(null);

function useLiveCopilotChatContext() {
  const ctx = useContext(LiveCopilotChatContext);
  if (!ctx) {
    throw new Error("LiveCopilotChat components must be used within LiveCopilotChatProvider");
  }
  return ctx;
}

export function LiveCopilotChatProvider({
  callId,
  children,
}: {
  callId: string;
  children: ReactNode;
}) {
  const persona = usePersona();
  const viewerRole: PodRole | "leadership" =
    persona === "leadership" || persona === "content-owner" ? "leadership" : persona;
  const podMember = podDisplayForRole(viewerRole);

  const messages = useBotChatStore((s) => {
    const st = s.byCallId[callId];
    if (!st) return EMPTY_BOT_CHAT_MESSAGES;
    return st.directMessages;
  });
  const appendMessage = useBotChatStore((s) => s.appendMessage);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const threadMessages = messages.filter(
    (m): m is BotChatMessage => m.role === "user" || m.role === "assistant"
  );

  useEffect(() => {
    if (threadMessages.length === 0 && !isLoading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [threadMessages.length, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInput("");
      setError(null);

      const userMessage: BotChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        authorName: podMember.name,
        authorRole: viewerRole === "leadership" ? "ae" : viewerRole,
        authorInitials: podMember.initials,
        createdAt: Date.now(),
        isPrivate: true,
      };

      appendMessage(callId, CHAT_MODE, userMessage);
      setIsLoading(true);

      try {
        const res = await fetch(`/api/calls/${callId}/bot-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            mode: CHAT_MODE,
            sender_name: podMember.name,
            sender_role: viewerRole === "leadership" ? "ae" : viewerRole,
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Copilot is not available");
        }

        const data = (await res.json()) as {
          content: string;
          citations?: Citation[];
          message_id?: string;
        };

        appendMessage(callId, CHAT_MODE, {
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
    [callId, isLoading, appendMessage, podMember, viewerRole]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMessage(input);
  }

  return (
    <LiveCopilotChatContext.Provider
      value={{
        threadMessages,
        isLoading,
        error,
        input,
        setInput,
        handleSubmit,
        messagesEndRef,
      }}
    >
      {children}
    </LiveCopilotChatContext.Provider>
  );
}

export function LiveCopilotChatThread({ className }: { className?: string }) {
  const { threadMessages, isLoading, messagesEndRef } = useLiveCopilotChatContext();

  if (threadMessages.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      <p className="text-[10px] font-semibold text-muted-foreground border-t border-border/50 pt-3">
        Copilot chat
      </p>
      {threadMessages.map((msg) => (
        <div
          key={msg.id}
          className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[92%] rounded-lg px-2.5 py-1.5 text-xs leading-snug",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "border border-border/60 bg-muted/40 text-foreground"
            )}
          >
            <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          </div>
        </div>
      ))}
      {isLoading && (
        <p className="text-[11px] text-muted-foreground animate-pulse">DC Copilot is thinking…</p>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export function LiveCopilotChatComposer({ className }: { className?: string }) {
  const { input, setInput, isLoading, error, handleSubmit } = useLiveCopilotChatContext();

  return (
    <div className={cn("shrink-0 border-t border-border/60 bg-transparent", className)}>
      {error && <p className={cn(liveColumnHorizontalPadding, "pt-2 text-[11px] text-destructive")}>{error}</p>}
      <form onSubmit={handleSubmit} className={cn("flex gap-2 py-4", liveColumnHorizontalPadding)}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask DC Copilot anything about this call…"
          disabled={isLoading}
          className="flex-1 text-sm"
          aria-label="Message DC Copilot"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
