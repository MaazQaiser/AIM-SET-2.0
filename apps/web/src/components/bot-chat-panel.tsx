"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  Lock,
  Paperclip,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BotChatSuggestedActions } from "@/components/bot-chat/bot-chat-suggested-actions";
import { CopilotFeedbackDialog } from "@/components/copilot/copilot-feedback-dialog";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { MicrophoneDictationButton } from "@/components/chat/microphone-dictation-button";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { cn } from "@/lib/cn";
import {
  buildSuggestedActions,
  checklistBantPct,
  type SuggestedActionsContext,
} from "@/lib/bot-chat/suggested-actions";
import { podDisplayForRole } from "@/lib/bot-chat/pod-display";
import type { BotChatMessage, BotChatPhase, SuggestedAction } from "@/lib/bot-chat/types";
import { EMPTY_BOT_CHAT_MESSAGES, useBotChatStore } from "@/stores/use-bot-chat";
import {
  type CopilotAgentAction,
  type CopilotCallExport,
  type CopilotMessage,
  useSalesCopilotStore,
} from "@/stores/use-sales-copilot";
import { usePersona } from "@/hooks/use-persona";
import {
  copilotSuggestionLabel,
  uniqueCopilotSuggestionLabels,
} from "@/lib/copilot/suggestion-label";
import {
  copilotInputPlaceholder,
  stripChatSourceFooters,
} from "@/lib/copilot/chat-response-display";
import type { CopilotFeedbackRating } from "@/lib/copilot/chat-feedback-store";
import type { CallBrief } from "@/lib/brief-types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { Citation, PodRole } from "@/types";

type CopilotSurface =
  | "home"
  | "pre_dc"
  | "live_dc"
  | "post_dc"
  | "knowledge"
  | "content"
  | "agents"
  | "settings"
  | "global";

const assistantProseClassName = [
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-strong:font-medium",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-3 [&_p+ul]:mt-1.5 [&_p+ol]:mt-1.5",
  "[&_h1]:mb-2.5 [&_h1]:mt-5 [&_h1]:type-panel-title",
  "[&_h2]:mb-2.5 [&_h2]:mt-5 [&_h2]:type-panel-title",
  "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:type-label",
  "[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:type-label",
  "[&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1.5 [&_li>p]:my-1",
  "[&_blockquote]:my-3 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-2",
  "[&_blockquote]:border-muted-foreground/20 [&_blockquote]:bg-background/45",
  "[&_blockquote]:py-1.5 [&_blockquote]:pl-3 [&_blockquote]:pr-2",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:font-normal",
  "[&_blockquote_p]:my-1.5",
].join(" ");

interface BotChatPanelProps {
  /** Local chat/thread identity. Use apiCallId to override the backend call scope. */
  callId: string;
  apiCallId?: string | null;
  className?: string;
  /** Embedded in page layout, or fixed floating dock at bottom center */
  variant?: "embedded" | "floating";
  phase?: BotChatPhase;
  surface?: CopilotSurface;
  context?: Record<string, unknown>;
  accountName?: string;
  brief?: CallBrief | null;
  /** Live-call context (optional in prep phase) */
  intentLabel?: string;
  painCount?: number;
  checklist?: DiscoveryChecklistState | null;
  transcriptLineCount?: number;
  hasObjections?: boolean;
  /** Post-DC wrap-up — discovery gaps from review */
  openGaps?: string[];
  /** Post-DC wrap-up — BANT coverage percentage for suggested actions */
  bantCoveragePct?: number;
  /** Post-DC: AE ↔ AI Copilot only — no pod/direct mode tabs */
  copilotOnly?: boolean;
}

const SURFACE_BY_PHASE: Record<BotChatPhase, CopilotSurface> = {
  prep: "pre_dc",
  live: "live_dc",
  wrapup: "post_dc",
};

const EMPTY_COPILOT_MESSAGES: CopilotMessage[] = [];
type MessageFeedback = CopilotFeedbackRating;

function downloadExport(exportPayload: CopilotCallExport, format: "json" | "markdown") {
  const cid = exportPayload.call_id ?? "call";
  let content: string;
  let mime: string;
  let ext: string;
  if (format === "markdown" && exportPayload.markdown) {
    content = exportPayload.markdown;
    mime = "text/markdown";
    ext = "md";
  } else {
    content = JSON.stringify(exportPayload, null, 2);
    mime = "application/json";
    ext = "json";
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cid}-summary.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function CopilotActionCards({ actions }: { actions: CopilotAgentAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {actions.map((a, i) => (
        <div
          key={`${a.tool ?? a.agent}-${i}`}
          className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 type-caption"
        >
          <span className="font-medium text-primary">
            {a.agent ? `Agent: ${a.agent}` : (a.tool ?? "Action")}
          </span>
          {a.summary && <p className="text-muted-foreground mt-0.5">{a.summary}</p>}
          {a.callId && <p className="text-muted-foreground/80 type-caption">Call: {a.callId}</p>}
        </div>
      ))}
    </div>
  );
}

function CopilotCallExports({ exports }: { exports: CopilotCallExport[] }) {
  if (!exports.length) return null;
  return (
    <details className="mt-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 type-caption">
      <summary className="cursor-pointer font-medium text-foreground">Call detail</summary>
      <div className="mt-2 space-y-2">
        {exports.map((ex, i) => (
          <div key={ex.call_id ?? i} className="space-y-1">
            <p className="text-muted-foreground">
              {(ex.call as { accountName?: string } | undefined)?.accountName ??
                ex.call_id ??
                "Call"}
            </p>
            {(ex.brief as { aiSummary?: string } | undefined)?.aiSummary && (
              <p className="line-clamp-3 text-foreground/90">
                {(ex.brief as { aiSummary?: string }).aiSummary}
              </p>
            )}
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 type-caption"
                onClick={() => downloadExport(ex, "json")}
              >
                <Download className="h-3 w-3 mr-1" />
                JSON
              </Button>
              {ex.markdown && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 type-caption"
                  onClick={() => downloadExport(ex, "markdown")}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Markdown
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function authorBadge(msg: BotChatMessage | CopilotMessage, copilotMode?: boolean) {
  if (msg.role === "assistant") {
    const label = copilotMode ? "Sales Co-pilot" : "DC Copilot";
    return (
      <span className="mb-1 flex items-center gap-1 type-caption font-medium text-muted-foreground">
        <Bot className="h-3 w-3" aria-hidden />
        {label}
      </span>
    );
  }
  if (msg.role === "system") return null;
  const authorName = "authorName" in msg ? msg.authorName : "You";
  const authorRole = "authorRole" in msg ? msg.authorRole : undefined;
  const isPrivate = "isPrivate" in msg ? msg.isPrivate : false;
  return (
    <span className="type-caption font-medium text-muted-foreground mb-1 block">
      {authorName}
      {authorRole ? ` · ${authorRole}` : ""}
      {isPrivate && (
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
  apiCallId,
  className,
  variant = "embedded",
  phase = "live",
  surface,
  context,
  accountName,
  brief,
  intentLabel,
  painCount = 0,
  checklist,
  transcriptLineCount = 0,
  hasObjections = false,
  openGaps: openGapsProp,
  bantCoveragePct: bantCoveragePctProp,
  copilotOnly = false,
}: BotChatPanelProps) {
  const { isIntercom } = useThemePreview();
  const persona = usePersona();
  const resolvedSurface = surface ?? SURFACE_BY_PHASE[phase] ?? "global";
  const backendCallId = apiCallId === undefined ? callId : apiCallId;
  const copilotThreadId = `${resolvedSurface}:${callId || "global"}`;
  const viewerRole: PodRole | "leadership" =
    persona === "leadership" || persona === "content-owner" ? "leadership" : persona;
  const podMember = podDisplayForRole(viewerRole);

  const mode = useBotChatStore((s) => s.byCallId[callId]?.mode ?? "group");
  const setMode = useBotChatStore((s) => s.setMode);
  const callMessages = useBotChatStore((s) => {
    const st = s.byCallId[callId];
    if (!st) return EMPTY_BOT_CHAT_MESSAGES;
    return mode === "group" ? st.groupMessages : st.directMessages;
  });
  const appendMessage = useBotChatStore((s) => s.appendMessage);
  const seedGroupWelcome = useBotChatStore((s) => s.seedGroupWelcome);

  const copilotMessages = useSalesCopilotStore(
    (s) => s.byThreadId[copilotThreadId] ?? EMPTY_COPILOT_MESSAGES
  );
  const copilotLoading = useSalesCopilotStore(
    (s) => s.loadingByThreadId[copilotThreadId] ?? false
  );
  const pendingFile = useSalesCopilotStore((s) => s.pendingFile);
  const appendCopilotMessage = useSalesCopilotStore((s) => s.appendMessage);
  const setCopilotLoading = useSalesCopilotStore((s) => s.setLoading);
  const setPendingFile = useSalesCopilotStore((s) => s.setPendingFile);
  const seedCopilotWelcome = useSalesCopilotStore((s) => s.seedWelcome);

  const [input, setInput] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  const isCopilotMode = mode === "copilot";
  const messages: (BotChatMessage | CopilotMessage)[] = isCopilotMode
    ? copilotMessages
    : callMessages;
  const isLoading = isCopilotMode ? copilotLoading : localLoading;
  const [error, setError] = useState<string | null>(null);
  const [floatingExpanded, setFloatingExpanded] = useState(false);
  const [floatingFullscreen, setFloatingFullscreen] = useState(false);
  const [inputWide, setInputWide] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, MessageFeedback>>({});
  const [feedbackDialog, setFeedbackDialog] = useState<{
    messageId: string;
    rating: MessageFeedback;
    response: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFloating = variant === "floating";
  const isFocusedFloating = isFloating && floatingFullscreen;

  useEffect(() => {
    if (!isFloating || !floatingExpanded) return;
    const onPointerDown = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setFloatingExpanded(false);
        setFloatingFullscreen(false);
        setInputWide(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isFloating, floatingExpanded]);

  useEffect(() => {
    if (mode === "group") seedGroupWelcome(callId, accountName);
    if (mode === "copilot") seedCopilotWelcome(copilotThreadId);
  }, [callId, accountName, mode, seedGroupWelcome, seedCopilotWelcome, copilotThreadId]);

  useEffect(() => {
    if (copilotOnly) setMode(callId, "copilot");
  }, [copilotOnly, callId, setMode]);

  const suggestedCtx: SuggestedActionsContext = useMemo(
    () => ({
      phase,
      mode,
      surface: resolvedSurface,
      persona: viewerRole,
      accountName,
      brief,
      intentLabel,
      painCount,
      openGaps: openGapsProp ?? checklist?.openGaps,
      bantCoveragePct: bantCoveragePctProp ?? checklistBantPct(checklist ?? null),
      transcriptLineCount,
      hasObjections,
    }),
    [
      phase,
      mode,
      resolvedSurface,
      viewerRole,
      accountName,
      brief,
      intentLabel,
      painCount,
      checklist,
      openGapsProp,
      bantCoveragePctProp,
      transcriptLineCount,
      hasObjections,
    ]
  );

  const suggestedActions = useMemo(() => buildSuggestedActions(suggestedCtx), [suggestedCtx]);
  const requestContext = useMemo(
    () => ({
      phase,
      surface: resolvedSurface,
      mode,
      persona: viewerRole,
      accountName,
      intentLabel,
      painCount,
      transcriptLineCount,
      hasObjections,
      openGaps: openGapsProp ?? checklist?.openGaps,
      bantCoveragePct: bantCoveragePctProp ?? checklistBantPct(checklist ?? null),
      briefReady: Boolean(brief),
      briefSummary: brief?.aiSummary,
      ...context,
    }),
    [
      phase,
      resolvedSurface,
      mode,
      viewerRole,
      accountName,
      intentLabel,
      painCount,
      transcriptLineCount,
      hasObjections,
      openGapsProp,
      checklist,
      bantCoveragePctProp,
      brief,
      context,
    ]
  );
  const messageCount = messages.length;

  useEffect(() => {
    if (messageCount === 0 && !isLoading) return;
    if (!userScrolledRef.current || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageCount, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (isLoading) return;
      if (!trimmed && !(isCopilotMode && pendingFile)) return;

      setInput("");
      if (isFloating) {
        setFloatingExpanded(true);
        setFloatingFullscreen(true);
        setInputWide(true);
      }
      setError(null);

      if (isCopilotMode) {
        let uploadNote = "";
        const file = pendingFile;
        if (file) {
          setCopilotLoading(true, copilotThreadId);
          try {
            const form = new FormData();
            form.append("file", file);
            form.append("title", file.name);
            const upRes = await fetch("/api/copilot/upload", { method: "POST", body: form });
            if (!upRes.ok) {
              const errBody = (await upRes.json().catch(() => ({}))) as { error?: string };
              throw new Error(errBody.error ?? "File upload failed");
            }
            const upData = (await upRes.json()) as { asset?: { id?: string; title?: string } };
            uploadNote = `\n[Uploaded to KB: ${upData.asset?.title ?? file.name} (asset ${upData.asset?.id ?? "pending"})]`;
            setPendingFile(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
            setCopilotLoading(false, copilotThreadId);
            return;
          }
        }

        const userContent = (trimmed || `Upload file: ${file?.name ?? "document"}`) + uploadNote;
        appendCopilotMessage(
          {
            id: crypto.randomUUID(),
            role: "user",
            content: userContent,
            createdAt: Date.now(),
          },
          copilotThreadId
        );

        const history = copilotMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-20)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        setCopilotLoading(true, copilotThreadId);
        const ctrl = new AbortController();
        const timeout = window.setTimeout(() => ctrl.abort(), 45000);
        try {
          const res = await fetch("/api/copilot/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              message: userContent,
              history,
              callId: backendCallId ?? undefined,
              surface: resolvedSurface,
              context: requestContext,
            }),
          });

          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? "Sales Co-pilot is not available");
          }

          const data = (await res.json()) as {
            content: string;
            citations?: Citation[];
            message_id?: string;
            actions_taken?: CopilotAgentAction[];
            call_exports?: CopilotCallExport[];
            suggestions?: string[];
            confidence?: number;
            missing_evidence?: string[];
          };

          appendCopilotMessage(
            {
              id: data.message_id ?? crypto.randomUUID(),
              role: "assistant",
              content: data.content,
              citations: data.citations,
              suggestions: data.suggestions,
              confidence: data.confidence,
              missingEvidence: data.missing_evidence,
              actions: (data.actions_taken ?? []).map((a) => {
                const row = a as Record<string, unknown>;
                return {
                  tool: typeof row.tool === "string" ? row.tool : undefined,
                  agent: typeof row.agent === "string" ? row.agent : undefined,
                  callId:
                    typeof row.call_id === "string"
                      ? row.call_id
                      : typeof row.callId === "string"
                        ? row.callId
                        : undefined,
                  status: typeof row.status === "string" ? row.status : undefined,
                  summary: typeof row.summary === "string" ? row.summary : undefined,
                };
              }),
              callExports: data.call_exports as CopilotCallExport[] | undefined,
              createdAt: Date.now(),
            },
            copilotThreadId
          );
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            setError("Sales Co-pilot timed out after 45s. Please try a shorter prompt.");
          } else {
            setError(err instanceof Error ? err.message : "Failed to send message");
          }
        } finally {
          window.clearTimeout(timeout);
          setCopilotLoading(false, copilotThreadId);
        }
        return;
      }

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
      setLocalLoading(true);

      try {
        const res = await fetch(`/api/calls/${callId}/bot-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            mode,
            sender_name: podMember.name,
            sender_role: viewerRole === "leadership" ? "ae" : viewerRole,
            context: requestContext,
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
          suggestions?: string[];
          confidence?: number;
          missing_evidence?: string[];
        };

        appendMessage(callId, mode, {
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
        setLocalLoading(false);
      }
    },
    [
      callId,
      backendCallId,
      copilotThreadId,
      resolvedSurface,
      requestContext,
      mode,
      isLoading,
      isFloating,
      isCopilotMode,
      appendMessage,
      appendCopilotMessage,
      copilotMessages,
      pendingFile,
      podMember,
      viewerRole,
      setPendingFile,
      setCopilotLoading,
    ]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage(input);
  }

  function handleSuggestedAction(action: SuggestedAction) {
    setFloatingExpanded(true);
    setFloatingFullscreen(true);
    setInputWide(true);
    void sendMessage(action.prompt);
  }

  const copyAssistantMessage = useCallback(async (messageId: string, content: string) => {
    const cleanContent = stripChatSourceFooters(content);
    try {
      await navigator.clipboard.writeText(cleanContent);
    } catch {
      // Clipboard access can be blocked in embedded browsers; still give local UI feedback.
    }
    setCopiedMessageId(messageId);
    window.setTimeout(() => setCopiedMessageId((current) => (current === messageId ? null : current)), 1600);
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
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const chatTopLabel = resolvedSurface === "live_dc" ? "Running Summary" : "Top";

  const inputPlaceholder = copilotOnly
    ? copilotInputPlaceholder(resolvedSurface, "Ask AI Copilot anything about this screen...")
    : isCopilotMode
      ? isFloating
        ? copilotInputPlaceholder(resolvedSurface, "Ask Sales Co-pilot anything...")
        : "Search company knowledge, run agents, inspect calls..."
      : mode === "group"
        ? isFloating
          ? "Ask me anything..."
          : "Message the pod or ask Copilot..."
        : isFloating
          ? "Ask Copilot privately..."
        : "Private question for Copilot...";

  const feedbackDialogNode = (
    <CopilotFeedbackDialog
      open={feedbackDialog !== null}
      onOpenChange={(open) => {
        if (!open) setFeedbackDialog(null);
      }}
      rating={feedbackDialog?.rating ?? null}
      messageId={feedbackDialog?.messageId ?? null}
      response={feedbackDialog?.response ?? ""}
      surface={resolvedSurface}
      callId={callId}
      onSaved={handleFeedbackSaved}
    />
  );

  const appendVoiceTranscript = useCallback((text: string) => {
    setInput((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text));
    setInputWide(true);
    setFloatingExpanded(true);
  }, []);

  const attachmentChip =
    isCopilotMode && !copilotOnly && pendingFile ? (
      <div className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-1 type-caption shrink-0 mb-2">
        <Paperclip className="h-3 w-3" aria-hidden />
        <span className="truncate max-w-[12rem]">{pendingFile.name}</span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Remove attachment"
          onClick={() => setPendingFile(null)}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    ) : null;

  const floatingInputRow = (
    <>
      {isCopilotMode && !copilotOnly && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 rounded-full text-[#111111] hover:bg-white/40"
            aria-label="Attach file to knowledge base"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => {
          setInputWide(true);
          setFloatingExpanded(true);
        }}
        placeholder={inputPlaceholder}
        className="call-detail-copilot-search-input flex-1 min-w-0 bg-transparent type-body text-[#111111] outline-none border-0 pl-1"
        aria-label={
          isCopilotMode
            ? "Sales Co-pilot message"
            : mode === "group"
              ? "Pod group message"
              : "Direct message to Copilot"
        }
      />
      <MicrophoneDictationButton
        onTranscript={appendVoiceTranscript}
        variant="ghost"
        className="h-8 w-8 rounded-full text-[#111111] hover:bg-white/40"
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading || (!input.trim() && !pendingFile)}
        aria-label="Send"
        className="h-9 w-9 shrink-0 rounded-full bg-[#111111] text-white hover:bg-[#111111]/90 disabled:bg-[#111111]/40"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
        )}
      </Button>
    </>
  );

  const floatingInputForm = (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "call-detail-copilot-input-bar flex flex-col gap-2 shrink-0",
        floatingExpanded && "border-t call-detail-copilot-divider"
      )}
    >
      {attachmentChip}
      <div className="flex min-h-[3.25rem] items-center gap-2 pl-4 pr-3 py-2">
        {floatingInputRow}
      </div>
    </form>
  );

  const chatInput = (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 shrink-0 border-t border-border p-3"
    >
      {attachmentChip}
      <div className="flex gap-2 w-full">
        {isCopilotMode && !copilotOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPendingFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </>
        )}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inputPlaceholder}
          className="flex-1 type-body"
          aria-label={
            isCopilotMode
              ? "Sales Co-pilot message"
              : mode === "group"
                ? "Pod group message"
                : "Direct message to Copilot"
          }
        />
        <MicrophoneDictationButton
          onTranscript={appendVoiceTranscript}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || (!input.trim() && !pendingFile)}
          aria-label="Send"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );

  const panelBody = (
    <>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2 shrink-0",
          copilotOnly && "px-4 py-3",
          isFloating
            ? "call-detail-copilot-divider px-4 py-2.5"
            : isIntercom
              ? "border-[#ebe7e1]"
              : "border-border"
        )}
      >
        {!copilotOnly && (
          <Bot
            className={cn("h-4 w-4 shrink-0", isIntercom ? "text-[#ff5600]" : "text-primary")}
            aria-hidden
          />
        )}
        <span className={cn("type-body font-medium truncate text-[#111111]")}>
          {copilotOnly ? "AI Copilot" : isCopilotMode ? "Sales Co-pilot" : "DC Copilot Pod"}
        </span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {isFloating && floatingExpanded && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-[#111111] hover:bg-white/40"
              aria-label="Minimize copilot"
              onClick={() => {
                setFloatingExpanded(false);
                setFloatingFullscreen(false);
                setInputWide(false);
              }}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
          {!copilotOnly ? (
            <>
              <div
                className={cn(
                  "inline-flex rounded-md border p-0.5",
                  isFloating ? "call-detail-copilot-tab-rail rounded-full" : "border-border bg-muted/30"
                )}
                role="tablist"
                aria-label="Chat mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "group"}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 type-caption font-medium transition-colors",
                    mode === "group"
                      ? isFloating
                        ? "call-detail-copilot-tab-active rounded-full"
                        : "bg-background text-foreground shadow-sm"
                      : isFloating
                        ? "call-detail-copilot-tab-inactive rounded-full"
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
                    "inline-flex items-center gap-1 rounded px-2 py-1 type-caption font-medium transition-colors",
                    mode === "direct"
                      ? isFloating
                        ? "call-detail-copilot-tab-active rounded-full"
                        : "bg-background text-foreground shadow-sm"
                      : isFloating
                        ? "call-detail-copilot-tab-inactive rounded-full"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setMode(callId, "direct")}
                >
                  <Lock className="h-3 w-3" aria-hidden />
                  Direct
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "copilot"}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 type-caption font-medium transition-colors",
                    mode === "copilot"
                      ? isFloating
                        ? "call-detail-copilot-tab-active rounded-full"
                        : "bg-background text-foreground shadow-sm"
                      : isFloating
                        ? "call-detail-copilot-tab-inactive rounded-full"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setMode(callId, "copilot")}
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Co-pilot
                </button>
              </div>
              <AIGeneratedBadge />
            </>
          ) : null}
        </div>
      </div>

      {!copilotOnly &&
        (isCopilotMode ? (
          <p
            className={cn(
              "type-caption px-3 py-1.5 border-b shrink-0",
              isFloating
                ? "call-detail-copilot-muted call-detail-copilot-divider px-4"
                : "text-muted-foreground border-border/60"
            )}
          >
            Global assistant — search company knowledge, inspect calls, run agents, or upload
            files.
          </p>
        ) : mode === "group" ? (
          <p
            className={cn(
              "type-caption px-3 py-1.5 border-b shrink-0",
              isFloating
                ? "call-detail-copilot-muted call-detail-copilot-divider px-4"
                : "text-muted-foreground border-border/60"
            )}
          >
            Shared with everyone on this call. Copilot replies appear for the whole pod.
          </p>
        ) : (
          <p
            className={cn(
              "type-caption px-3 py-1.5 border-b shrink-0",
              isFloating
                ? "call-detail-copilot-muted call-detail-copilot-divider px-4"
                : "text-muted-foreground border-border/60"
            )}
          >
            Private to you — teammates do not see direct messages or replies.
          </p>
        ))}

      <BotChatSuggestedActions
        actions={suggestedActions}
        onSelect={handleSuggestedAction}
        disabled={isLoading}
        variant={copilotOnly && !isFocusedFloating ? "list" : "chips"}
        className={cn(
          isFloating && "call-detail-copilot-divider border-b px-4",
          isFocusedFloating && "mx-auto w-full max-w-4xl border-b-0 px-8 py-3"
        )}
        buttonClassName={isFloating ? "call-detail-copilot-suggested-btn" : undefined}
      />

      <div
        ref={listRef}
        className={cn(
          "flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0",
          isFloating && "call-detail-copilot-messages px-4",
          isFocusedFloating && "space-y-5 px-5 py-6 md:px-8"
        )}
        onScroll={() => {
          const el = listRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          userScrolledRef.current = !atBottom;
        }}
      >
        {messages.length === 0 && !error && (copilotOnly || mode === "direct") && (
          <p
            className={cn(
              "type-body text-center py-6 px-2",
              isFloating ? "call-detail-copilot-muted" : "text-muted-foreground"
            )}
          >
            {phase === "wrapup"
              ? "Ask about next steps, client email, Jira handoff, or how to close open gaps."
              : "Ask DC Copilot privately about this call — prep questions, talk tracks, or live coaching."}
          </p>
        )}
        {error && (
          <p className="type-body text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3">
            {error}
          </p>
        )}
        {messages.map((msg) => {
          const copilotMsg = msg as CopilotMessage;
          const isPrivate = "isPrivate" in msg && msg.isPrivate;
          const assistantContent =
            msg.role === "assistant" ? stripChatSourceFooters(msg.content) : msg.content;
          const feedback = messageFeedback[msg.id];
          return (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
                msg.role === "system" && "justify-center",
                isFocusedFloating && "mx-auto w-full max-w-4xl"
              )}
            >
              <div
                className={cn(
                  "min-w-0 type-body",
                  !isFocusedFloating &&
                    msg.role !== "assistant" &&
                    "max-w-[92%] rounded-lg px-3 py-2",
                  msg.role === "user" &&
                    (isFocusedFloating
                      ? "max-w-[70%] rounded-xl bg-[#111111] px-4 py-2.5 text-white"
                      : isFloating
                      ? "call-detail-copilot-message-user"
                      : "bg-primary text-primary-foreground"),
                  msg.role === "assistant" &&
                    (isFocusedFloating
                      ? "w-full max-w-none px-0 py-1 text-[#20242a]"
                      : "max-w-[92%] px-0 py-1 text-foreground"),
                  msg.role === "system" &&
                    (isFloating
                      ? "call-detail-copilot-muted type-label text-center border border-dashed call-detail-copilot-divider max-w-full bg-white/20"
                      : "bg-muted/40 text-muted-foreground type-label text-center border border-dashed border-border max-w-full")
                )}
              >
                {authorBadge(msg, isCopilotMode)}
                {msg.role === "assistant" ? (
                  <div
                    className={cn(
                      assistantProseClassName,
                      isFloating && "call-detail-copilot-prose"
                    )}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{assistantContent}</ReactMarkdown>
                    {isCopilotMode && copilotMsg.actions && copilotMsg.actions.length > 0 && (
                      <CopilotActionCards actions={copilotMsg.actions} />
                    )}
                    {isCopilotMode &&
                      copilotMsg.callExports &&
                      copilotMsg.callExports.length > 0 && (
                        <CopilotCallExports exports={copilotMsg.callExports} />
                      )}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-3 border-t border-border/40 pt-2">
                        <p className="mb-1.5 type-kicker text-muted-foreground">
                          Next
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueCopilotSuggestionLabels(msg.suggestions).map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              disabled={isLoading}
                              className={cn(
                                "rounded-md border px-2 py-1 type-caption font-medium transition-colors disabled:opacity-50",
                                isFloating
                                  ? "call-detail-copilot-suggested-btn text-[#111111]/80 hover:bg-white/40"
                                  : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                              )}
                              onClick={() => void sendMessage(copilotSuggestionLabel(suggestion))}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div
                      className={cn(
                        "mt-2 flex items-center gap-1 text-muted-foreground",
                        isFocusedFloating ? "pt-1" : "pt-0.5"
                      )}
                      aria-label="Response actions"
                    >
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted/70 hover:text-foreground"
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
                          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted/70 hover:text-foreground",
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
                          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted/70 hover:text-foreground",
                          feedback === "down" && "bg-muted text-foreground"
                        )}
                        title="Not helpful"
                        aria-label="Mark response not helpful"
                        onClick={() => openMessageFeedback(msg.id, "down", msg.content)}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                )}
                {isPrivate && <span className="sr-only">Private message</span>}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <Badge variant="secondary" className="gap-1.5 type-caption">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              <span>
                {isCopilotMode ? "Sales Co-pilot is thinking…" : "DC Copilot is thinking…"}
              </span>
            </Badge>
          </div>
        )}
        {(messages.length > 0 || isLoading) && (
          <div className="sticky bottom-2 z-10 flex justify-center">
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 type-caption font-medium shadow-sm transition-colors",
                isFloating
                  ? "call-detail-liquid-glass text-[#111111]/70 hover:text-[#111111]"
                  : "border-border bg-background/90 text-muted-foreground hover:text-foreground"
              )}
              title={`Back to ${chatTopLabel}`}
              aria-label={`Back to ${chatTopLabel}`}
              onClick={scrollChatToTop}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              <span>{chatTopLabel}</span>
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!isFloating && chatInput}
    </>
  );

  if (isFloating) {
    const dockExpanded = inputWide || floatingExpanded;
    const dockFullscreen = floatingExpanded && floatingFullscreen;

    return (
      <>
        {dockFullscreen && (
          <div
            className="call-detail-urbanist fixed inset-0 z-[55] bg-background/70 backdrop-blur-sm"
            aria-hidden
          />
        )}
        <div
          ref={dockRef}
          className={cn(
            "call-detail-urbanist fixed z-[60] flex flex-col pointer-events-none",
            "transition-[inset,width,height,transform] duration-300 ease-out",
            dockFullscreen
              ? "inset-3 translate-x-0 sm:inset-6"
              : cn(
                  "bottom-10 left-1/2 -translate-x-1/2",
                  dockExpanded
                    ? "w-[min(calc(100%-2.5rem),42rem)]"
                    : "w-[min(calc(100%-5rem),19rem)]"
                ),
            className
          )}
          aria-label="DC Copilot floating chat"
        >
          <div
            className={cn(
              "call-detail-liquid-glass call-detail-liquid-glass--dock pointer-events-auto flex w-full flex-col overflow-hidden transition-[border-radius,height] duration-300 ease-out",
              dockFullscreen ? "h-full rounded-xl" : dockExpanded ? "rounded-2xl" : "rounded-full",
              floatingExpanded && "call-detail-liquid-glass--expanded"
            )}
          >
            {floatingExpanded && (
              <div
                className={cn(
                  "call-detail-copilot-panel-body flex flex-col overflow-hidden",
                  dockFullscreen
                    ? "min-h-0 flex-1"
                    : "min-h-[240px] max-h-[min(420px,50vh)]"
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col">{panelBody}</div>
              </div>
            )}
            {floatingInputForm}
          </div>
        </div>
        {feedbackDialogNode}
      </>
    );
  }

  return (
    <>
      <div className={cn("flex flex-col h-full min-h-0 bg-card", className)}>{panelBody}</div>
      {feedbackDialogNode}
    </>
  );
}
