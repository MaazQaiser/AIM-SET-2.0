"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Edit3,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Bot,
  Wand2,
} from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { Badge } from "@dc-copilot/ui/components/badge";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { Separator } from "@dc-copilot/ui/components/separator";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import type { PostCallEmailAttachments } from "@/lib/brief-types";

export interface EmailDraft {
  id: string;
  audience?: "client" | "internal" | string;
  to: string[];
  cc?: string[];
  subject: string;
  body_markdown: string;
  style_signals: string[];
  commitments_referenced: string[];
  status: "draft_pending_approval" | "approved" | "sent";
  attachments?: PostCallEmailAttachments;
}

interface EmailEditorProps {
  draft: EmailDraft;
  title?: string;
  description?: string;
  onRegenerate?: () => void;
}

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function appendSection(body: string, heading: string, note: string) {
  const trimmed = body.trimEnd();
  const line = note.startsWith("-") ? note : `- ${note}`;
  return `${trimmed}\n\n${heading}:\n${line}`;
}

function shortenEmailBody(body: string) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 8) return body;
  const greeting = lines[0];
  const closing = lines.slice(-2).join("\n");
  return [greeting, "", ...lines.slice(1, 7), "", closing].join("\n");
}

function formatEmailForCopy(draft: EmailDraft) {
  return [
    `To: ${draft.to.join(", ")}`,
    ...(draft.cc?.length ? [`CC: ${draft.cc.join(", ")}`] : []),
    `Subject: ${draft.subject}`,
    "",
    draft.body_markdown.trim(),
  ].join("\n");
}

function applyAssistantInstruction(draft: EmailDraft, instruction: string): EmailDraft {
  const request = instruction.trim();
  const lowered = request.toLowerCase();
  let next: EmailDraft = {
    ...draft,
    style_signals: [...draft.style_signals],
    commitments_referenced: [...draft.commitments_referenced],
  };
  let changed = false;

  const explicitSubject = request.match(/(?:subject|title)\s*:\s*(.+)$/i);
  if (explicitSubject?.[1]) {
    next = { ...next, subject: explicitSubject[1].trim() };
    changed = true;
  } else if (lowered.includes("shorter subject") || lowered.includes("concise subject")) {
    next = { ...next, subject: next.subject.split(":")[0].slice(0, 72).trim() };
    changed = true;
  }

  if (/(shorter|shorten|concise|tighten)/i.test(request)) {
    next = { ...next, body_markdown: shortenEmailBody(next.body_markdown) };
    next.style_signals = uniq([...next.style_signals, "concise"]);
    changed = true;
  }

  if (/(formal|polish|professional)/i.test(request)) {
    next = {
      ...next,
      body_markdown: next.body_markdown
        .replace(/^Hi\b/i, "Hello")
        .replace(/\bThanks\b/g, "Thank you"),
    };
    next.style_signals = uniq([...next.style_signals, "polished", "professional"]);
    changed = true;
  }

  if (/(add|include|mention|attach|attachment|looking forward)/i.test(request)) {
    const note = request.replace(/^(please\s+)?(add|include|mention)\s+/i, "").trim();
    const heading = /(attach|attachment)/i.test(request) ? "Attachment note" : "Additional note";
    next = { ...next, body_markdown: appendSection(next.body_markdown, heading, note) };
    changed = true;
  }

  if (!changed) {
    next = { ...next, body_markdown: appendSection(next.body_markdown, "Requested update", request) };
  }

  return next;
}

export function EmailEditor({
  draft,
  title = "Follow-up Email",
  description,
  onRegenerate,
}: EmailEditorProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(draft);
  const [showCommitments, setShowCommitments] = useState(false);
  const [sent, setSent] = useState(draft.status === "sent");
  const [copied, setCopied] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantBusy, setAssistantBusy] = useState(false);

  useEffect(() => {
    setLocal(draft);
    setSent(draft.status === "sent");
    setEditing(false);
  }, [draft]);

  async function handleCopyEmail() {
    const text = formatEmailForCopy(local);
    const copied = await copyTextToClipboard(text);
    if (copied) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  async function handleAssistantUpdate() {
    const request = assistantInput.trim();
    if (!request || assistantBusy) return;
    setAssistantBusy(true);
    setAssistantMessages((messages) => [
      ...messages,
      { id: `user-${Date.now()}`, role: "user", text: request },
    ]);
    await new Promise((r) => setTimeout(r, 250));
    setLocal((current) => applyAssistantInstruction(current, request));
    setEditing(true);
    setAssistantInput("");
    setAssistantMessages((messages) => [
      ...messages,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: "Updated the editable draft. Review the wording before copying.",
      },
    ]);
    setAssistantBusy(false);
  }

  return (
    <div className="glass-insight-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <AIGeneratedBadge />
          {sent && (
            <Badge className="text-xs bg-success/10 text-success border-success/30 border">Sent</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!sent && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          {!sent && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {description ? (
        <div className="border-b bg-muted/10 px-4 py-2">
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      ) : null}

      {/* To / CC */}
      <div className="px-4 py-3 space-y-2 border-b">
        <div className="flex items-start gap-3">
          <Label className="text-xs text-muted-foreground w-6 shrink-0 mt-1">To</Label>
          {editing ? (
            <Input
              className="h-7 text-xs"
              value={local.to.join(", ")}
              onChange={(e) => setLocal({ ...local, to: e.target.value.split(",").map((s) => s.trim()) })}
            />
          ) : (
            <span className="text-xs">{local.to.join(", ")}</span>
          )}
        </div>
        {(local.cc ?? []).length > 0 && (
          <div className="flex items-start gap-3">
            <Label className="text-xs text-muted-foreground w-6 shrink-0 mt-1">CC</Label>
            <span className="text-xs text-muted-foreground">{(local.cc ?? []).join(", ")}</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <Label className="text-xs text-muted-foreground w-6 shrink-0 mt-1">Sub</Label>
          {editing ? (
            <Input
              className="h-7 text-xs"
              value={local.subject}
              onChange={(e) => setLocal({ ...local, subject: e.target.value })}
            />
          ) : (
            <span className="text-xs font-medium">{local.subject}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {editing ? (
          <Textarea
            className="min-h-[200px] text-sm font-mono resize-none"
            value={local.body_markdown}
            onChange={(e) => setLocal({ ...local, body_markdown: e.target.value })}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {local.body_markdown}
          </div>
        )}
      </div>

      {!sent && (
        <>
          <Separator />
          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Bot className="h-3.5 w-3.5 text-primary" />
              Email assistant
            </div>
            {assistantMessages.length > 0 && (
              <div className="max-h-28 space-y-1.5 overflow-auto rounded-md border border-border bg-muted/20 p-2">
                {assistantMessages.slice(-4).map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "ml-6 rounded-md bg-background px-2 py-1 text-xs text-foreground"
                        : "mr-6 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
                    }
                  >
                    {message.text}
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="h-8 text-xs"
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleAssistantUpdate();
                  }
                }}
                placeholder="Ask for changes to this email"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 gap-1.5 text-xs"
                onClick={handleAssistantUpdate}
                disabled={!assistantInput.trim() || assistantBusy}
              >
                {assistantBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Update draft
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Commitments referenced */}
      {local.commitments_referenced.length > 0 && (
        <>
          <Separator />
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={() => setShowCommitments(!showCommitments)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCommitments ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {local.commitments_referenced.length} commitment{local.commitments_referenced.length > 1 ? "s" : ""} referenced
            </button>
            {showCommitments && (
              <ul className="mt-2 space-y-1">
                {local.commitments_referenced.map((c) => (
                  <li key={c} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">·</span>
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      {!sent && (
        <>
          <Separator />
          <div className={`flex items-center px-4 py-3 ${editing ? "justify-between" : "justify-end"}`}>
            {editing && (
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
                  Done editing
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLocal(draft); setEditing(false); }}>
                  Discard edits
                </Button>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyEmail}
                  aria-label={copied ? "Email copied" : "Copy email"}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied" : "Copy email"}</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}
