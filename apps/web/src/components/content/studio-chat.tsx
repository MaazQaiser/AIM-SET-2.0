"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { TemplatePicker } from "@/components/content/template-picker";
import { cn } from "@/lib/cn";
import type { ContentTemplate, StudioTurnResult } from "@/types/content_studio";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredMessage {
  id: string;
  role: string;
  content: Record<string, unknown>;
  turnType?: string | null;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
  isError?: boolean;
}

interface StreamRevision {
  revision_id?: string;
  html?: string;
  template_id?: string;
  message?: string;
}

// ─── SSE event types coming from the backend ─────────────────────────────────
interface SseToken { type: "token"; text: string }
interface SseRevision { type: "revision"; revision_id?: string; html?: string; template_id?: string; message?: string }
interface SseError { type: "error"; text: string }
type SseEvent = SseToken | SseRevision | SseError;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface StudioChatHandle {
  sendGenerate: () => void;
  hasTemplate: () => boolean;
}

export function StudioChat({
  projectId,
  messages,
  onTurn,
  onRefetch,
  selectedTemplateId,
  onTemplateSelect,
  templates = [],
  isLoadingTemplates = false,
  recommendedTemplateIds,
  hasSuggestionContext = false,
  isBootstrapping = false,
  chatRef,
}: {
  projectId: string;
  messages: StoredMessage[];
  onTurn: (result: StudioTurnResult) => void;
  onRefetch: () => void;
  selectedTemplateId?: string;
  onTemplateSelect?: (id: string) => void;
  templates?: ContentTemplate[];
  isLoadingTemplates?: boolean;
  recommendedTemplateIds?: string[];
  hasSuggestionContext?: boolean;
  isBootstrapping?: boolean;
  chatRef?: React.RefObject<StudioChatHandle | null>;
}) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamError, setStreamError] = useState("");
  const [showRequired, setShowRequired] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Expose sendGenerate for the parent page to call via the Generate button
  useEffect(() => {
    if (chatRef) {
      (chatRef as React.MutableRefObject<StudioChatHandle | null>).current = {
        hasTemplate: () => Boolean(selectedTemplateId),
        sendGenerate: () => {
          if (!selectedTemplateId) {
            setShowRequired(true);
            return;
          }
          setShowRequired(false);
          void sendMessage("", true);
        },
      };
    }
  });

  // Convert stored server messages → display messages
  const persistedDisplay = useMemo<DisplayMessage[]>(() => {
    return messages.map((msg) => ({
      id: msg.id,
      role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      text: extractText(msg.content),
    }));
  }, [messages]);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [persistedDisplay, streamingText]);

  // ── Core streaming send ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string, generate = false) => {
      const trimmedText = text.trim();
      if (!trimmedText && !generate) return;
      if (isStreaming) return;

      setInput("");
      setStreamError("");
      setStreamingText("");
      setIsStreaming(true);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const response = await fetch(
          `/api/content/studio/projects/${projectId}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmedText || (generate ? "Generate the content now" : ""),
              templateId: selectedTemplateId,
              generate,
            }),
            signal: abortRef.current.signal,
          }
        );

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => "Request failed");
          setStreamError(errText || "Request failed");
          setIsStreaming(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        let pendingRevision: StreamRevision | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            for (const line of block.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();

              if (data === "[DONE]") {
                break;
              }

              let event: SseEvent;
              try {
                event = JSON.parse(data) as SseEvent;
              } catch {
                continue;
              }

              if (event.type === "token") {
                accumulatedText += event.text;
                // Strip signal tags from display text
                const displayChunk = cleanSignalTags(accumulatedText);
                setStreamingText(displayChunk);
              } else if (event.type === "revision") {
                pendingRevision = event;
              } else if (event.type === "error") {
                setStreamError(event.text);
              }
            }
          }
        }

        // Stream finished — trigger side effects
        if (pendingRevision) {
          onTurn({
            project_id: projectId,
            turn_type: "html",
            html: pendingRevision.html,
            revision_id: pendingRevision.revision_id,
            template_id: pendingRevision.template_id,
            message: pendingRevision.message,
          });
        }

        onRefetch();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled — no error
        } else {
          setStreamError(err instanceof Error ? err.message : "Unexpected error");
        }
      } finally {
        setStreamingText("");
        setIsStreaming(false);
      }
    },
    [isStreaming, projectId, selectedTemplateId, onTurn, onRefetch]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  const isEmpty = persistedDisplay.length === 0 && !streamingText && !isStreaming && !isBootstrapping;

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[320px]">

        {isEmpty && !hasSuggestionContext && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Start the conversation — tell me what you'd like to create.
          </div>
        )}

        {isEmpty && hasSuggestionContext && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Loading your suggested plan from discovery context…
          </div>
        )}

        {(isBootstrapping && persistedDisplay.length === 0) && (
          <AssistantBubble isStreaming>
            <TypingDots />
            <span className="ml-1 text-sm">Preparing your plan…</span>
          </AssistantBubble>
        )}

        {persistedDisplay.map((msg) => (
          msg.role === "user" ? (
            <UserBubble key={msg.id} text={msg.text} />
          ) : (
            <AssistantBubble key={msg.id}>
              <FormattedText text={msg.text} />
            </AssistantBubble>
          )
        ))}

        {/* Live streaming bubble */}
        {isStreaming && streamingText && (
          <AssistantBubble isStreaming>
            <FormattedText text={streamingText} />
            <span className="inline-block ml-0.5 h-4 w-1 bg-current animate-cursor translate-y-0.5" />
          </AssistantBubble>
        )}

        {/* Thinking indicator — before any text arrives */}
        {isStreaming && !streamingText && (
          <AssistantBubble isStreaming>
            <TypingDots />
          </AssistantBubble>
        )}

        {/* Error bubble */}
        {streamError && (
          <AssistantBubble isError>
            <span className="text-sm">{streamError}</span>
          </AssistantBubble>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border p-3 space-y-2">
        {onTemplateSelect ? (
          <TemplatePicker
            templates={templates}
            recommendedIds={recommendedTemplateIds}
            selectedId={selectedTemplateId}
            onSelect={(id) => {
              setShowRequired(false);
              onTemplateSelect(id);
            }}
            isLoading={isLoadingTemplates}
            showRequired={showRequired}
          />
        ) : null}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Agent is thinking…" : "Reply with details or ask for a change…"}
            rows={2}
            disabled={isStreaming}
            className="resize-none flex-1 text-sm"
          />
          <Button
            size="icon"
            onClick={() => void sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
          >
            {isStreaming ? (
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex justify-end">
      <div className="max-w-[86%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm bg-primary text-primary-foreground shadow-sm">
        <div className="mb-0.5 text-[11px] font-semibold opacity-70">You</div>
        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function AssistantBubble({
  children,
  isStreaming = false,
  isError = false,
}: {
  children: React.ReactNode;
  isStreaming?: boolean;
  isError?: boolean;
}) {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[92%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm shadow-sm",
          isError
            ? "border border-destructive/40 bg-destructive/10 text-destructive"
            : "border border-border/60 bg-muted/50 text-foreground",
          isStreaming && !isError && "border-primary/20 bg-primary/5"
        )}
      >
        <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold opacity-60">
          <Bot className="h-3 w-3" />
          Agent
        </div>
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  // Render numbered slide outlines with subtle formatting
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5 whitespace-pre-wrap text-sm">
      {lines.map((line, i) => {
        const isSlide = /^slide\s+\d+\s*[–—-]/i.test(line.trim());
        return (
          <p
            key={i}
            className={cn(
              "leading-relaxed",
              isSlide && "font-medium text-foreground/90 mt-1.5 first:mt-0"
            )}
          >
            {line || "\u00a0"}
          </p>
        );
      })}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Agent is thinking">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${dot * 140}ms` }}
        />
      ))}
    </span>
  );
}

// Starter prompt chips shown when the chat is empty
export function StarterPrompts({
  artifactType,
  onSelect,
}: {
  artifactType: string;
  onSelect: (text: string) => void;
}) {
  const prompts =
    artifactType === "one_pager"
      ? [
          "Create a one-pager for a healthcare solution",
          "Build an executive summary for a new product",
          "Draft a competitive battlecard one-pager",
        ]
      : artifactType === "image"
        ? [
            "Create a social media visual for a product launch",
            "Design a hero banner for a tech event",
          ]
        : [
            "Build a pitch deck for a retail prospect",
            "Create a 10-slide executive overview",
            "Design a case study presentation for a customer win",
          ];

  return (
    <div className="flex flex-col gap-1.5">
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
        >
          <Sparkles className="h-3 w-3 shrink-0 text-primary/70" />
          {p}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractText(content: Record<string, unknown>): string {
  if (!content) return "";
  const direct = content.text ?? content.message;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  // Legacy scripted message formats
  const ask = content.ask;
  if (Array.isArray(ask) && ask.length > 0) {
    return ask.map((q) => String(q)).join("\n");
  }
  if (typeof ask === "string" && ask.trim()) return ask.trim();

  // Slide outline
  const outline = content.slide_outline;
  if (Array.isArray(outline) && outline.length > 0) {
    const intro = typeof content.message === "string" ? content.message + "\n\n" : "";
    const slides = outline
      .map((item) => {
        if (typeof item !== "object" || !item) return "";
        const s = item as Record<string, unknown>;
        const num = s.slide ?? "";
        const heading = s.heading ?? "Slide";
        const body = s.body ? `\n  ${s.body}` : "";
        return `Slide ${num} – ${heading}${body}`;
      })
      .filter(Boolean)
      .join("\n");
    return (intro + slides).trim();
  }

  const turnType = content.turn_type;
  if (turnType === "html" || content.revision_id) {
    return typeof content.message === "string" && content.message
      ? content.message
      : "Draft is ready in the preview. Tell me what to change or refine.";
  }

  if (typeof content.message === "string" && content.message.trim()) {
    return content.message.trim();
  }

  return "";
}

function cleanSignalTags(text: string): string {
  return text
    .replace(/<generate_now\s*\/>/g, "")
    .replace(/<update_slide[^>]*>[\s\S]*?<\/update_slide>/g, "")
    .trimEnd();
}
