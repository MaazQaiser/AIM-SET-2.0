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
  type RefObject,
} from "react";
import { ArrowUp, Check, Copy, Loader2, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopilotFeedbackDialog } from "@/components/copilot/copilot-feedback-dialog";
import { MicrophoneDictationButton } from "@/components/chat/microphone-dictation-button";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { usePersona } from "@/hooks/use-persona";
import { podDisplayForRole } from "@/lib/bot-chat/pod-display";
import type { BotChatMessage } from "@/lib/bot-chat/types";
import type { Citation, PodRole } from "@/types";
import { liveColumnHorizontalPadding } from "@/components/live/live-column-header";
import { cn } from "@/lib/cn";
import {
  copilotSuggestionLabel,
  uniqueCopilotSuggestionLabels,
} from "@/lib/copilot/suggestion-label";
import { stripChatSourceFooters } from "@/lib/copilot/chat-response-display";
import type { CopilotFeedbackRating } from "@/lib/copilot/chat-feedback-store";
import { EMPTY_BOT_CHAT_MESSAGES, useBotChatStore } from "@/stores/use-bot-chat";

const CHAT_MODE = "direct" as const;
const assistantProseClassName = [
  "prose prose-xs dark:prose-invert max-w-none type-label leading-[1.65]",
  "prose-strong:font-medium",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-3 [&_p+ul]:mt-1.5 [&_p+ol]:mt-1.5",
  "[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:type-panel-title",
  "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:type-panel-title",
  "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:type-label",
  "[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:type-label",
  "[&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1.5 [&_li>p]:my-1",
  "[&_blockquote]:my-3 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-2",
  "[&_blockquote]:border-muted-foreground/20 [&_blockquote]:bg-background/45",
  "[&_blockquote]:py-1.5 [&_blockquote]:pl-3 [&_blockquote]:pr-2",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:font-normal",
  "[&_blockquote_p]:my-1.5",
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
  sendMessage: (text: string) => Promise<void>;
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
    async (text: string) => {
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
      <div className={cn("space-y-2", className)} aria-live="polite">
        <p className="type-caption font-medium text-muted-foreground border-t border-border/50 pt-3">
          Copilot chat
        </p>
        <div ref={chatTopRef} />
        {threadMessages.map((msg) => {
          const feedback = messageFeedback[msg.id];
          const assistantContent =
            msg.role === "assistant" ? stripChatSourceFooters(msg.content) : msg.content;
          return (
            <div
              key={msg.id}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[92%] type-label leading-relaxed",
                  msg.role === "user"
                    ? "rounded-lg bg-primary px-2.5 py-2 text-primary-foreground"
                    : "px-0 py-1 text-foreground"
                )}
              >
                {msg.role === "assistant" ? (
                  <>
                    <div className={assistantProseClassName}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{assistantContent}</ReactMarkdown>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-muted-foreground">
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
                  <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                )}
              </div>
            </div>
          );
        })}
        {suggestions.length > 0 && !isLoading && (
          <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2">
            <p className="mb-1.5 type-kicker text-muted-foreground">
              Next
            </p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueCopilotSuggestionLabels(suggestions).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-md border border-border/70 bg-background px-2 py-1 type-caption font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
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
          <div className="sticky bottom-2 z-10 flex justify-center">
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-background/90 px-3 type-caption font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              title="Back to Running Summary"
              aria-label="Back to Running Summary"
              onClick={scrollChatToTop}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
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
      {error && <p className={cn(liveColumnHorizontalPadding, "pt-2 type-caption text-destructive")}>{error}</p>}
      <form onSubmit={handleSubmit} className={cn("flex gap-2 py-4", liveColumnHorizontalPadding)}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for the next question, proof point, or talk track..."
          className="flex-1 type-body"
          aria-label="Message DC Copilot"
        />
        <MicrophoneDictationButton
          onTranscript={appendVoiceTranscript}
          className="h-9 w-9"
        />
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
