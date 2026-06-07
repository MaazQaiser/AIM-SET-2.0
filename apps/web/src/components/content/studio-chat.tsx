"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Image,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { Badge } from "@dc-copilot/ui/components/badge";
import { TemplatePicker } from "@/components/content/template-picker";
import { cn } from "@/lib/cn";
import type { ContentTemplate, StudioSlideOutlineItem, StudioTurnResult } from "@/types/content_studio";
import type { KBAsset } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredMessage {
  id: string;
  role: string;
  content: Record<string, unknown>;
  turnType?: string | null;
  createdAt?: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  slideOutline?: StudioSlideOutlineItem[];
  isStreaming?: boolean;
  isError?: boolean;
  createdAt?: string;
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
  kbAssets = [],
  artifactType,
  projectTitle,
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
  kbAssets?: KBAsset[];
  artifactType?: string;
  projectTitle?: string;
}) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamError, setStreamError] = useState("");
  const [showRequired, setShowRequired] = useState(false);
  const [kbPanelOpen, setKbPanelOpen] = useState(true);
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

  // Detect if the selected template has two body sections
  const isTwoSection = useMemo(() => {
    if (!selectedTemplateId || !templates.length) return false;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return false;
    const sectionCount = tpl.metadata?.conversion?.sectionCount ?? 1;
    if (sectionCount >= 2) return true;
    const slots = tpl.metadata?.conversion?.slots ?? [];
    const bodySlots = slots.filter(
      (s) =>
        s.type === "body" ||
        s.label.toLowerCase().includes("body") ||
        s.id.toLowerCase().includes("section") ||
        s.id.toLowerCase().includes("column") ||
        s.id.toLowerCase().includes("left") ||
        s.id.toLowerCase().includes("right")
    );
    return bodySlots.length >= 2;
  }, [selectedTemplateId, templates]);

  // Convert stored server messages → display messages
  const persistedDisplay = useMemo<DisplayMessage[]>(() => {
    return messages.map((msg) => {
      const rawOutline = msg.content.slide_outline;
      const slideOutline = Array.isArray(rawOutline)
        ? (rawOutline as StudioSlideOutlineItem[])
        : undefined;
      return {
        id: msg.id,
        role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        text: extractText(msg.content),
        slideOutline,
        createdAt: msg.createdAt,
      };
    });
  }, [messages]);

  // Score KB assets against this project's context (type + title keywords)
  const kbMatches = useMemo<KBAsset[]>(() => {
    if (!kbAssets.length) return [];
    const keywords = (projectTitle ?? "")
      .toLowerCase()
      .split(/[\s,./\-_]+/)
      .filter((kw) => kw.length > 3);
    return kbAssets
      .map((asset) => ({ asset, score: scoreKbForStudio(asset, artifactType, keywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ asset }) => asset);
  }, [kbAssets, artifactType, projectTitle]);

  // Collapse KB panel once the conversation has messages
  useEffect(() => {
    if (persistedDisplay.length > 0) setKbPanelOpen(false);
  }, [persistedDisplay.length]);

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
          // User cancelled
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

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function handleKbChipClick(asset: KBAsset) {
    const ref = `Using "${asset.title}" as reference — `;
    setInput((prev) => (prev ? prev + " " + ref : ref));
    textareaRef.current?.focus();
  }

  const isEmpty = persistedDisplay.length === 0 && !streamingText && !isStreaming && !isBootstrapping;

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* KB context panel */}
      {kbMatches.length > 0 && (
        <KbContextPanel
          assets={kbMatches}
          open={kbPanelOpen}
          onToggle={() => setKbPanelOpen((v) => !v)}
          onChipClick={handleKbChipClick}
        />
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[320px]">

        {isEmpty && !hasSuggestionContext && (
          <div className="space-y-3">
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Start the conversation — tell me what you&apos;d like to create.
            </div>
            {artifactType && (
              <StarterPrompts
                artifactType={artifactType}
                onSelect={(text) => {
                  setInput(text);
                  textareaRef.current?.focus();
                }}
              />
            )}
          </div>
        )}

        {isEmpty && hasSuggestionContext && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Loading your suggested plan from discovery context…
          </div>
        )}

        {(isBootstrapping && persistedDisplay.length === 0) && (
          <AssistantBubble isStreaming copyText="">
            <TypingDots />
            <span className="ml-1 text-sm">Preparing your plan…</span>
          </AssistantBubble>
        )}

        {persistedDisplay.map((msg) =>
          msg.role === "user" ? (
            <UserBubble key={msg.id} text={msg.text} createdAt={msg.createdAt} />
          ) : (
            <AssistantBubble key={msg.id} createdAt={msg.createdAt} copyText={msg.text}>
              {msg.slideOutline && msg.slideOutline.length > 0 ? (
                <SlideOutlinePreview
                  outline={msg.slideOutline}
                  isTwoSection={isTwoSection}
                  introText={msg.text}
                />
              ) : (
                <MarkdownText text={msg.text} />
              )}
            </AssistantBubble>
          )
        )}

        {/* Live streaming bubble */}
        {isStreaming && streamingText && (
          <AssistantBubble isStreaming copyText={streamingText}>
            <MarkdownText text={streamingText} />
            <span className="inline-block ml-0.5 h-4 w-1 bg-current animate-cursor translate-y-0.5" />
          </AssistantBubble>
        )}

        {/* Thinking indicator */}
        {isStreaming && !streamingText && (
          <AssistantBubble isStreaming copyText="">
            <TypingDots />
          </AssistantBubble>
        )}

        {/* Error bubble */}
        {streamError && (
          <AssistantBubble isError copyText={streamError}>
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
        {/* Two-section hint */}
        {isTwoSection && selectedTemplateId && (
          <p className="text-[11px] text-muted-foreground px-0.5">
            ✦ Template has two content sections — the outline will show both columns per slide.
          </p>
        )}
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
          {isStreaming ? (
            <Button
              size="icon"
              variant="outline"
              onClick={handleStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="border-destructive/40 hover:bg-destructive/10 text-destructive"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={() => void sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Slide Outline Preview ────────────────────────────────────────────────────

function SlideOutlinePreview({
  outline,
  isTwoSection,
  introText,
}: {
  outline: StudioSlideOutlineItem[];
  isTwoSection: boolean;
  introText: string;
}) {
  // Extract just the introductory sentence (before the slides)
  const intro = introText.split(/\n/)[0]?.trim() ?? "";

  return (
    <div className="space-y-2 w-full">
      {intro && (
        <p className="text-sm leading-relaxed text-foreground/90 pb-1">{intro}</p>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pb-0.5">
        {outline.length}-slide outline
        {isTwoSection && (
          <span className="ml-2 normal-case font-normal text-primary/70">· two-section template</span>
        )}
      </p>
      {outline.map((slide) => (
        <SlideCard key={slide.slide} slide={slide} isTwoSection={isTwoSection} />
      ))}
      <p className="text-[11px] text-muted-foreground pt-1">
        Tell me what to change on any slide, or click <strong>Generate</strong> when this looks right.
      </p>
    </div>
  );
}

const SLIDE_MODE_LABEL: Record<string, { label: string; cls: string }> = {
  reuse: { label: "reuse from KB", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  hybrid: { label: "hybrid", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  generate: { label: "generate", cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

function SlideCard({
  slide,
  isTwoSection,
}: {
  slide: StudioSlideOutlineItem;
  isTwoSection: boolean;
}) {
  const modeInfo = slide.mode ? SLIDE_MODE_LABEL[slide.mode] : undefined;
  // Show two columns only when both section fields are present AND template supports it
  const showTwoCol = isTwoSection && Boolean(slide.section_a || slide.section_b);

  return (
    <div className="rounded-lg border border-border/70 bg-background overflow-hidden text-sm">
      {/* Slide header row */}
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
        <span className="flex h-5 min-w-[2rem] items-center justify-center rounded bg-primary/10 px-1.5 text-[10px] font-bold text-primary tabular-nums">
          {String(slide.slide).padStart(2, "0")}
        </span>
        <span className="flex-1 truncate font-semibold text-foreground text-[13px]">
          {slide.heading}
        </span>
        {modeInfo && (
          <span className={cn("rounded border px-1.5 py-0 text-[10px] font-medium", modeInfo.cls)}>
            {modeInfo.label}
          </span>
        )}
      </div>

      {/* Slide content */}
      <div className="px-3 py-2.5 space-y-2.5">
        {showTwoCol ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Section A
              </p>
              <p className="text-xs leading-relaxed text-foreground/80">
                {slide.section_a ?? slide.body}
              </p>
            </div>
            <div className="space-y-1 border-l border-border/40 pl-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Section B
              </p>
              <p className="text-xs leading-relaxed text-foreground/80">
                {slide.section_b}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-foreground/80">{slide.body}</p>
        )}

        {slide.visual && (
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Image className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
            <span className="italic">{slide.visual}</span>
          </div>
        )}

        {slide.evidence && (
          <p className="text-[11px] text-muted-foreground/60 italic leading-snug line-clamp-2">
            Source: {slide.evidence}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── KB Context Panel ─────────────────────────────────────────────────────────

const KB_TYPE_LABELS: Record<string, string> = {
  "deck": "Deck",
  "case-study": "Case Study",
  "one-pager": "One-Pager",
  "battlecard": "Battlecard",
  "architecture": "Architecture",
  "image": "Image",
};

function KbContextPanel({
  assets,
  open,
  onToggle,
  onChipClick,
}: {
  assets: KBAsset[];
  open: boolean;
  onToggle: () => void;
  onChipClick: (asset: KBAsset) => void;
}) {
  return (
    <div className="shrink-0 border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          From your knowledge base ({assets.length})
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 opacity-60" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => onChipClick(asset)}
              title={`Use "${asset.title}" as reference`}
              className="flex items-start gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-accent/50 group"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground/90 group-hover:text-foreground">
                  {asset.title}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4">
                {KB_TYPE_LABELS[asset.type] ?? asset.type}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserBubble({ text, createdAt }: { text: string; createdAt?: string }) {
  if (!text) return null;
  return (
    <div className="flex justify-end">
      <div className="max-w-[86%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm bg-primary text-primary-foreground shadow-sm">
        <div className="mb-0.5 flex items-center justify-between gap-3 text-[11px] font-semibold opacity-70">
          <span>You</span>
          {createdAt && <span className="font-normal">{formatRelativeTime(createdAt)}</span>}
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function AssistantBubble({
  children,
  isStreaming = false,
  isError = false,
  createdAt,
  copyText,
}: {
  children: React.ReactNode;
  isStreaming?: boolean;
  isError?: boolean;
  createdAt?: string;
  copyText: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!copyText) return;
    void navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex justify-start group/msg">
      <div
        className={cn(
          "relative w-full max-w-full rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm shadow-sm",
          isError
            ? "border border-destructive/40 bg-destructive/10 text-destructive"
            : "border border-border/60 bg-muted/50 text-foreground",
          isStreaming && !isError && "border-primary/20 bg-primary/5"
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-semibold opacity-60">
          <span className="flex items-center gap-1">
            <Bot className="h-3 w-3" />
            Agent
          </span>
          <span className="flex items-center gap-2 font-normal">
            {createdAt && <span>{formatRelativeTime(createdAt)}</span>}
            {!isError && !isStreaming && copyText && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy message"
                className="opacity-0 group-hover/msg:opacity-100 transition-opacity hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </span>
        </div>
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let keyCounter = 0;

  function nextKey() {
    return keyCounter++;
  }

  function flushList() {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={nextKey()} className="list-disc pl-4 space-y-0.5 my-1">
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      nodes.push(
        <p key={nextKey()} className={cn("font-semibold mt-2 first:mt-0", level === 1 ? "text-base" : "text-sm")}>
          {renderInline(headingMatch[2])}
        </p>
      );
      continue;
    }

    const listMatch = line.match(/^[-*•]\s+(.+)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }

    flushList();

    if (!line.trim()) {
      nodes.push(<div key={nextKey()} className="h-1" />);
      continue;
    }

    const isSlide = /^slide\s+\d+\s*[–—-]/i.test(line.trim());
    nodes.push(
      <p key={nextKey()} className={cn("leading-relaxed", isSlide && "font-medium text-foreground/90 mt-1.5 first:mt-0")}>
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  return <div className="space-y-0.5 text-sm">{nodes}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part || null;
  });
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
        : artifactType === "case_study"
          ? [
              "Write a case study for a retail customer win",
              "Build a case study showing ROI for a financial services client",
              "Draft a customer success story for a healthcare deal",
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

function scoreKbForStudio(
  asset: KBAsset,
  artifactType: string | undefined,
  keywords: string[]
): number {
  if (artifactType) {
    const typeMatches =
      (artifactType === "deck" && asset.type === "deck") ||
      (artifactType === "one_pager" &&
        (asset.type === "one-pager" || asset.type === "battlecard")) ||
      (artifactType === "case_study" && asset.type === "case-study") ||
      (artifactType === "image" && asset.type === "image");
    if (!typeMatches) return 0;
  }

  const haystack =
    `${asset.title} ${asset.tags.join(" ")} ${asset.fileName ?? ""}`.toLowerCase();
  let score = 1;

  for (const kw of keywords) {
    if (kw.length > 2 && haystack.includes(kw)) {
      score += 2;
    }
  }

  if (typeof asset.effectivenessScore === "number") {
    score += asset.effectivenessScore * 0.01;
  }

  return score;
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function extractText(content: Record<string, unknown>): string {
  if (!content) return "";
  const direct = content.text ?? content.message;
  if (typeof direct === "string" && direct.trim()) {
    // For outline turns, return just the intro message (not the full slide list)
    if (content.turn_type === "outline") return direct.trim();
    return direct.trim();
  }

  const ask = content.ask;
  if (Array.isArray(ask) && ask.length > 0) {
    return ask.map((q) => String(q)).join("\n");
  }
  if (typeof ask === "string" && ask.trim()) return ask.trim();

  // Build readable text version of slide outline (used for copy)
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
        const sA = s.section_a ? `\n  [A] ${s.section_a}` : "";
        const sB = s.section_b ? `\n  [B] ${s.section_b}` : "";
        const visual = s.visual ? `\n  Visual: ${s.visual}` : "";
        return `Slide ${num} – ${heading}${sA || sB ? sA + sB : body}${visual}`;
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
