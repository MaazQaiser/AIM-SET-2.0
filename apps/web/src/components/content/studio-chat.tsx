"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { cn } from "@/lib/cn";
import { useStudioMessage } from "@/lib/data/content-studio-hooks";
import type { StudioTurnResult } from "@/types/content_studio";

interface Message {
  id: string;
  role: string;
  content: Record<string, unknown>;
  turnType?: string | null;
}

interface DisplayMessage extends Message {
  animate?: boolean;
  local?: boolean;
  tone?: "default" | "error";
}

export function StudioChat({
  projectId,
  messages,
  onTurn,
  selectedTemplateId,
  hasSuggestionContext = false,
  isBootstrapping = false,
}: {
  projectId: string;
  messages: Message[];
  onTurn: (result: StudioTurnResult) => void;
  selectedTemplateId?: string;
  hasSuggestionContext?: boolean;
  isBootstrapping?: boolean;
}) {
  const [input, setInput] = useState("");
  const [transientMessages, setTransientMessages] = useState<DisplayMessage[]>([]);
  const [animatedServerIds, setAnimatedServerIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const seenServerIdsRef = useRef<Set<string> | null>(null);
  const send = useStudioMessage(projectId);

  const persistedMessages = useMemo<DisplayMessage[]>(
    () =>
      messages.map((message) => ({
        ...message,
        animate: animatedServerIds.has(message.id),
      })),
    [messages, animatedServerIds]
  );

  const animatedTransientSignatures = useMemo(
    () =>
      new Set(
        transientMessages
          .filter((message) => message.animate)
          .map((message) => messageSignature(message))
      ),
    [transientMessages]
  );

  const persistedSignatures = useMemo(
    () => new Set(persistedMessages.map((message) => messageSignature(message))),
    [persistedMessages]
  );

  const displayMessages = useMemo(() => {
    const persisted = persistedMessages.filter(
      (message) => !animatedTransientSignatures.has(messageSignature(message))
    );
    const transient = transientMessages.filter(
      (message) => message.animate || !persistedSignatures.has(messageSignature(message))
    );
    return [...persisted, ...transient];
  }, [animatedTransientSignatures, persistedMessages, persistedSignatures, transientMessages]);

  useEffect(() => {
    const currentIds = new Set(messages.map((message) => message.id));
    if (seenServerIdsRef.current === null) {
      seenServerIdsRef.current = currentIds;
      return;
    }

    const seen = seenServerIdsRef.current;
    const newAssistantIds = messages
      .filter((message) => {
        if (message.role !== "assistant" || seen.has(message.id)) return false;
        return !animatedTransientSignatures.has(messageSignature(message));
      })
      .map((message) => message.id);

    if (newAssistantIds.length > 0) {
      setAnimatedServerIds((prev) => {
        const next = new Set(prev);
        for (const id of newAssistantIds) next.add(id);
        return next;
      });
    }
    seenServerIdsRef.current = currentIds;
  }, [animatedTransientSignatures, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  });

  async function handleSend() {
    if (!input.trim() || send.isPending) return;
    const text = input.trim();
    setInput("");
    const userMessage: DisplayMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: { text },
      local: true,
    };
    setTransientMessages((prev) => [...prev, userMessage]);

    try {
      const envelope = await send.mutateAsync({
        message: text,
        templateId: selectedTemplateId,
        generate: false,
      });
      const assistantMessage: DisplayMessage = {
        id: `local-assistant-${envelope.result.revision_id ?? Date.now()}`,
        role: "assistant",
        content: envelope.result as unknown as Record<string, unknown>,
        turnType: envelope.result.turn_type,
        animate: true,
        local: true,
      };
      setTransientMessages((prev) => [...prev, assistantMessage]);
      onTurn(envelope.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent could not complete that turn.";
      setTransientMessages((prev) => [
        ...prev,
        {
          id: `local-error-${Date.now()}`,
          role: "assistant",
          content: { text: message },
          animate: true,
          local: true,
          tone: "error",
        },
      ]);
    }
  }

  function handleAnimationDone(message: DisplayMessage) {
    if (message.local) {
      setTransientMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, animate: false } : item))
      );
      return;
    }
    setAnimatedServerIds((prev) => {
      if (!prev.has(message.id)) return prev;
      const next = new Set(prev);
      next.delete(message.id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[320px]">
        {displayMessages.length === 0 && !send.isPending && !isBootstrapping && (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            {hasSuggestionContext
              ? "Loading your suggested plan from discovery context…"
              : "What should we create first?"}
          </div>
        )}
        {displayMessages.length === 0 && (send.isPending || isBootstrapping) && (
          <div className="mr-10 flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-1">
            <Bot className="h-4 w-4" />
            <TypingDots />
            <span>Preparing your slide plan…</span>
          </div>
        )}
        {displayMessages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onQuestionClick={(question) => setInput(question.endsWith("?") ? `${question} ` : question)}
            onAnimationDone={() => handleAnimationDone(message)}
          />
        ))}
        {send.isPending && (
          <div className="mr-10 flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-1">
            <Bot className="h-4 w-4" />
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Reply with details or ask for a tweak..."
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button
          size="icon"
          onClick={() => void handleSend()}
          disabled={send.isPending || !input.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  onQuestionClick,
  onAnimationDone,
}: {
  message: DisplayMessage;
  onQuestionClick: (question: string) => void;
  onAnimationDone: () => void;
}) {
  const isUser = message.role === "user";
  const text = messageText(message);
  const questions = isUser ? [] : extractQuestionPrompts(message.content);

  return (
    <div className={cn("flex animate-in fade-in-0 slide-in-from-bottom-1", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[86%] rounded-md px-3 py-2 text-sm shadow-soft-xs",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border/70 bg-muted/60 text-foreground",
          message.tone === "error" && "border-destructive/40 bg-destructive/10 text-destructive"
        )}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium opacity-75">
          {!isUser && <Bot className="h-3.5 w-3.5" />}
          <span>{isUser ? "You" : "Agent"}</span>
        </div>
        <p className="whitespace-pre-wrap leading-6">
          <TypingText text={text} active={Boolean(message.animate && !isUser)} onDone={onAnimationDone} />
        </p>
        {questions.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {questions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onQuestionClick(question)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingText({
  text,
  active,
  onDone,
}: {
  text: string;
  active: boolean;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(active ? "" : text);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    doneRef.current = false;
    if (!active) {
      setVisible(text);
      return;
    }

    setVisible("");
    let index = 0;
    const step = Math.max(1, Math.ceil(text.length / 120));
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + step);
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          window.setTimeout(() => onDoneRef.current(), 450);
        }
      }
    }, 14);

    return () => window.clearInterval(timer);
  }, [active, text]);

  return (
    <>
      {visible}
      {active && visible.length < text.length && (
        <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 bg-current animate-cursor" />
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Agent is typing">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${dot * 120}ms` }}
        />
      ))}
    </span>
  );
}

function messageText(message: Message): string {
  if (message.role === "user") {
    return stringField(message.content, "text") || "";
  }

  const content = message.content;
  const directText = stringField(content, "text");
  if (directText) return directText;

  const outline = slideOutlineText(content);
  const slidePlan = arrayField(content, "slide_plan").filter(isRecord);
  const planOutline = slidePlan.length > 0 ? slideOutlineText({ slide_outline: slidePlan }) : "";
  if (outline || planOutline) {
    const intro =
      stringField(content, "message") ||
      "Here is the proposed slide plan. Tell me what to change on any slide, or click Generate when it looks right.";
    const kbLines = kbMatchesText(content);
    return [intro, kbLines, planOutline || outline].filter(Boolean).join("\n\n");
  }

  const turnType = stringField(content, "turn_type") || message.turnType || "";
  const askItems = extractAskItems(content);
  if (askItems.length > 0 && turnType !== "outline") {
    if (askItems.length === 1 && !isQuestionPrompt(askItems[0])) {
      return askItems[0];
    }
    return "I need a little more detail before I draft:";
  }

  const recommended = arrayField(content, "recommended_templates");
  if (turnType === "recommend" || recommended.length > 0) {
    const lines = recommended
      .map((item, index) => {
        if (!isRecord(item)) return "";
        const rationale = stringField(item, "rationale");
        return rationale ? `${index + 1}. ${rationale}` : "";
      })
      .filter(Boolean);
    return ["I found templates that fit this content.", ...lines].join("\n");
  }

  if (turnType === "html" || stringField(content, "revision_id")) {
    const assistantMessage = stringField(content, "message");
    return (
      assistantMessage ||
      "Draft is ready in the preview. Send a note if you want me to tighten the story, change tone, or revise a specific slide."
    );
  }

  if (turnType === "patch" || isRecord(content.patch)) {
    const assistantMessage = stringField(content, "message");
    if (assistantMessage) return assistantMessage;
    const slide = isRecord(content.patch) ? stringField(content.patch, "slide") : "";
    return slide ? `Updated slide ${slide}. The preview has the latest version.` : "Updated the draft. The preview has the latest version.";
  }

  const assistantMessage = stringField(content, "message");
  if (assistantMessage) return assistantMessage;

  return "I captured that. Send the next detail when you are ready.";
}

function messageSignature(message: Message): string {
  return `${message.role}:${messageText(message)}`;
}

function kbMatchesText(content: Record<string, unknown>): string {
  const matches = arrayField(content, "kb_matches").filter(isRecord);
  if (matches.length === 0) return "";

  const lines = matches
    .map((item, index) => {
      const title = stringField(item, "title") || "Knowledge base document";
      const snippet = stringField(item, "snippet");
      return snippet ? `${index + 1}. ${title} — ${snippet}` : `${index + 1}. ${title}`;
    })
    .filter(Boolean);

  return lines.length > 0 ? ["Related KB content:", ...lines].join("\n") : "";
}

function slideOutlineText(content: Record<string, unknown>): string {
  const outline = arrayField(content, "slide_outline").filter(isRecord);
  if (outline.length === 0) return "";

  return outline
    .map((item) => {
      const slide = Number(item.slide) || 0;
      const label = slide > 0 ? `Slide ${String(slide).padStart(2, "0")}` : "Slide";
      const heading = stringField(item, "heading") || "Untitled";
      const body = stringField(item, "body");
      const visual = stringField(item, "visual");
      const mode = stringField(item, "mode");
      const evidence = stringField(item, "evidence") || stringField(item, "citation_source");
      const reuse = isRecord(item.reuse) ? item.reuse : null;
      const reuseText = reuse
        ? `Reuse: ${stringField(reuse, "source_vertical") || "KB"} slide ${stringField(reuse, "source_slide_index") || "?"}`
        : "";
      const modeLabel =
        mode === "reuse" ? "[Reuse]" : mode === "hybrid" ? "[Hybrid]" : mode === "generate" ? "[Generate]" : "";
      return [
        `${label}${modeLabel ? ` ${modeLabel}` : ""}: ${heading}`,
        body ? `Body: ${body}` : "",
        visual ? `Visual: ${visual}` : "",
        evidence ? `Evidence: ${evidence}` : "",
        reuseText,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function extractAskItems(content: Record<string, unknown>): string[] {
  return arrayField(content, "ask")
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 3);
}

function extractQuestionPrompts(content: Record<string, unknown>): string[] {
  return extractAskItems(content).filter(isQuestionPrompt);
}

function isQuestionPrompt(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (!value || value.startsWith("requirements captured")) return false;
  return value.endsWith("?") || value.startsWith("what ") || value.startsWith("who ") || value.startsWith("should ");
}

function stringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function arrayField(obj: Record<string, unknown>, key: string): unknown[] {
  const value = obj[key];
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
