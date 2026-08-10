"use client";

import { MicrophoneDictationButton } from "@/components/chat/microphone-dictation-button";
import { CopilotFeedbackDialog } from "@/components/copilot/copilot-feedback-dialog";
import { SummitLogoMark } from "@/components/layout/sidebar-icons";
import { liveColumnHorizontalPadding } from "@/components/live/live-column-header";
import { usePersona } from "@/hooks/use-persona";
import { podDisplayForRole } from "@/lib/bot-chat/pod-display";
import type { BotChatMessage } from "@/lib/bot-chat/types";
import { cn } from "@/lib/cn";
import type { CopilotFeedbackRating } from "@/lib/copilot/chat-feedback-store";
import { stripChatSourceFooters } from "@/lib/copilot/chat-response-display";
import {
  copilotSuggestionLabel,
  uniqueCopilotSuggestionLabels,
} from "@/lib/copilot/suggestion-label";
import { EMPTY_BOT_CHAT_MESSAGES, useBotChatStore } from "@/stores/use-bot-chat";
import type { Citation, PodRole } from "@/types";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { ArrowUp, Check, Copy, Loader2, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CHAT_MODE = "direct" as const;
const assistantProseClassName = [
  "prose prose-xs dark:prose-invert max-w-none type-label leading-[1.62]",
  "prose-strong:font-medium",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2 [&_p+ul]:mt-1 [&_p+ol]:mt-1",
  "[&_h1]:mb-1.5 [&_h1]:mt-6 [&_h1]:type-panel-title",
  "[&_h2]:mb-1.5 [&_h2]:mt-6 [&_h2]:type-panel-title",
  "[&_h3]:mb-1 [&_h3]:mt-5 [&_h3]:type-label",
  "[&_h4]:mb-1 [&_h4]:mt-5 [&_h4]:type-label",
  "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_li>p]:my-0.5",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2",
  "[&_blockquote]:border-muted-foreground/25",
  "[&_blockquote]:py-0.5 [&_blockquote]:pl-3",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:font-normal",
  "[&_blockquote_p]:my-1",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
  "[&_th]:border-b [&_th]:border-border/60 [&_th]:px-2 [&_th]:py-1.5 [&_th]:align-top [&_th]:font-medium",
  "[&_td]:border-b [&_td]:border-border/40 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top",
  "[&_td]:break-words",
].join(" ");
type MessageFeedback = CopilotFeedbackRating;

type LiveCopilotChatContextValue = {
  callId: string;
  threadMessages: BotChatMessage[];
  isLoading: boolean;
  error: string | null;
  suggestions: string[];
  input: string;
  setInput: (value: string) => void;
  sendMessage: (text: string, extraContext?: Record<string, unknown>) => Promise<void>;
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

export function useLiveCopilotChat() {
  return useLiveCopilotChatContext();
}

export function LiveCopilotChatProvider({
  callId,
  context,
  children,
}: {
  callId: string;
  context?: Record<string, unknown>;
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const threadMessages = messages.filter(
    (m): m is BotChatMessage => m.role === "user" || m.role === "assistant"
  );

  useEffect(() => {
    if (threadMessages.length === 0 && !isLoading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [threadMessages.length, isLoading]);

  const sendMessage = useCallback(
    async (text: string, extraContext?: Record<string, unknown>) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInput("");
      setError(null);
      setSuggestions([]);

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
            context: {
              surface: "live_dc",
              mode: CHAT_MODE,
              ...context,
              ...extraContext,
            },
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
          suggestions?: string[];
          confidence?: number;
          missing_evidence?: string[];
        };
        setSuggestions(data.suggestions ?? []);

        appendMessage(callId, CHAT_MODE, {
          id: data.message_id ?? crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          citations: data.citations,
          suggestions: data.suggestions,
          confidence: data.confidence,
          missingEvidence: data.missing_evidence,
          authorName: "DC Copilot",
          createdAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsLoading(false);
      }
    },
    [callId, context, isLoading, appendMessage, podMember, viewerRole]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMessage(input);
  }

  return (
    <LiveCopilotChatContext.Provider
      value={{
        callId,
        threadMessages,
        isLoading,
        error,
        suggestions,
        input,
        setInput,
        sendMessage,
        handleSubmit,
        messagesEndRef,
      }}
    >
      {children}
    </LiveCopilotChatContext.Provider>
  );
}

export function LiveCopilotChatThread({
  className,
  scrollContainerRef,
}: {
  className?: string;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}) {
  const { callId, threadMessages, isLoading, suggestions, sendMessage, messagesEndRef } =
    useLiveCopilotChatContext();
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, MessageFeedback>>({});
  const [feedbackDialog, setFeedbackDialog] = useState<{
    messageId: string;
    rating: MessageFeedback;
    response: string;
  } | null>(null);
  const chatTopRef = useRef<HTMLDivElement>(null);

  const copyAssistantMessage = useCallback(async (messageId: string, content: string) => {
    const cleanContent = stripChatSourceFooters(content);
    try {
      await navigator.clipboard.writeText(cleanContent);
    } catch {
      // Clipboard access can be blocked in embedded browsers; still give local UI feedback.
    }
    setCopiedMessageId(messageId);
    window.setTimeout(
      () => setCopiedMessageId((current) => (current === messageId ? null : current)),
      1600
    );
  }, []);

  const openMessageFeedback = useCallback(
    (messageId: string, feedback: MessageFeedback, content: string) => {
      setFeedbackDialog({
        messageId,
        rating: feedback,
        response: stripChatSourceFooters(content),
      });
    },
    []
  );

  const handleFeedbackSaved = useCallback((messageId: string, feedback: MessageFeedback) => {
    setMessageFeedback((current) => ({ ...current, [messageId]: feedback }));
  }, []);

  const scrollChatToTop = useCallback(() => {
    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    chatTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollContainerRef]);

  if (threadMessages.length === 0 && !isLoading) {
    return null;
  }

  const feedbackDialogNode = (
    <CopilotFeedbackDialog
      open={feedbackDialog !== null}
      onOpenChange={(open) => {
        if (!open) setFeedbackDialog(null);
      }}
      rating={feedbackDialog?.rating ?? null}
      messageId={feedbackDialog?.messageId ?? null}
      response={feedbackDialog?.response ?? ""}
      surface="live_dc"
      callId={callId}
      onSaved={handleFeedbackSaved}
    />
  );

  return (
    <>
      <div className={cn("space-y-5", className)} aria-live="polite">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-t border-border/50 bg-background/95 pt-3 pb-2 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 type-caption font-medium text-muted-foreground">
            <span aria-hidden="true">
              <SummitLogoMark className="h-4 w-4" />
            </span>
            <span className="truncate">Copilot chat</span>
          </div>
        </div>
        <div ref={chatTopRef} />
        {threadMessages.map((msg) => {
          const feedback = messageFeedback[msg.id];
          const assistantContent =
            msg.role === "assistant" ? stripChatSourceFooters(msg.content) : msg.content;
          return (
            <div
              key={msg.id}
              className={cn(
                "border-t border-border/35 pt-4 first:border-t-0 first:pt-0",
                msg.role === "user" ? "flex flex-col items-end pl-8" : "pl-0"
              )}
            >
              <p
                className={cn(
                  "mb-1 flex items-center gap-1.5 type-caption",
                  msg.role === "user"
                    ? "justify-end font-medium text-muted-foreground"
                    : "font-semibold text-foreground"
                )}
              >
                {msg.role === "user" ? (
                  <>
                    <span>{msg.authorName ?? "You"}</span>
                    <span aria-hidden="true">
                      <SummitLogoMark className="h-3.5 w-3.5" />
                    </span>
                  </>
                ) : (
                  "DC Copilot"
                )}
              </p>
              {msg.role === "assistant" ? (
                <>
                  <div className={assistantProseClassName}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{assistantContent}</ReactMarkdown>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-muted-foreground">
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted/70 hover:text-foreground"
                      title="Copy response"
                      aria-label="Copy response"
                      onClick={() => void copyAssistantMessage(msg.id, msg.content)}
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted/70 hover:text-foreground",
                        feedback === "up" && "bg-muted text-foreground"
                      )}
                      title="Helpful"
                      aria-label="Mark response helpful"
                      onClick={() => openMessageFeedback(msg.id, "up", msg.content)}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted/70 hover:text-foreground",
                        feedback === "down" && "bg-muted text-foreground"
                      )}
                      title="Not helpful"
                      aria-label="Mark response not helpful"
                      onClick={() => openMessageFeedback(msg.id, "down", msg.content)}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </>
              ) : (
                <p className="max-w-[86%] whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/45 px-3 py-2 text-right type-label leading-relaxed text-foreground">
                  {msg.content}
                </p>
              )}
            </div>
          );
        })}
        {suggestions.length > 0 && !isLoading && (
          <div className="border-t border-border/40 pt-4">
            <p className="mb-2 type-kicker text-muted-foreground">Next</p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueCopilotSuggestionLabels(suggestions).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-foreground/85 bg-transparent px-2.5 py-1 type-caption font-medium text-foreground transition-colors hover:border-foreground hover:bg-transparent"
                  onClick={() => void sendMessage(copilotSuggestionLabel(suggestion))}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {isLoading && (
          <p className="inline-flex items-center gap-1.5 type-caption text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            <span>DC Copilot is thinking…</span>
          </p>
        )}
        {(threadMessages.length > 0 || isLoading) && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="inline-flex h-6 items-center justify-center gap-1.5 rounded-full border border-foreground bg-foreground px-2.5 type-caption font-medium text-background shadow-sm transition-colors hover:bg-foreground/90"
              title="Back to Running Summary"
              aria-label="Back to Running Summary"
              onClick={scrollChatToTop}
            >
              <ArrowUp className="h-3 w-3" aria-hidden />
              <span>Running Summary</span>
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {feedbackDialogNode}
    </>
  );
}

export function LiveCopilotChatComposer({ className }: { className?: string }) {
  const { input, setInput, isLoading, error, handleSubmit } = useLiveCopilotChatContext();
  const appendVoiceTranscript = useCallback(
    (text: string) => {
      setInput(input.trim() ? `${input.trimEnd()} ${text}` : text);
    },
    [input, setInput]
  );

  return (
    <div className={cn("shrink-0 border-t border-border/60 bg-transparent", className)}>
      {error && (
        <p className={cn(liveColumnHorizontalPadding, "pt-2 type-caption text-destructive")}>
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className={cn("flex gap-2 py-4", liveColumnHorizontalPadding)}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for the next question, proof point, or talk track..."
          className="flex-1 type-body"
          aria-label="Message DC Copilot"
        />
        <MicrophoneDictationButton onTranscript={appendVoiceTranscript} className="h-9 w-9" />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
