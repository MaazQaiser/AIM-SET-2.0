"use client";

import { useState } from "react";
import { Send, Edit3, RefreshCw, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { Separator } from "@/components/ui/separator";

interface EmailDraft {
  id: string;
  to: string[];
  cc?: string[];
  subject: string;
  body_markdown: string;
  style_signals: string[];
  commitments_referenced: string[];
  status: "draft_pending_approval" | "approved" | "sent";
}

interface EmailEditorProps {
  draft: EmailDraft;
  onApprove?: (draft: EmailDraft) => void;
  onRegenerate?: () => void;
}

export function EmailEditor({ draft, onApprove, onRegenerate }: EmailEditorProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(draft);
  const [showCommitments, setShowCommitments] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(draft.status === "sent");

  async function handleApprove() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    onApprove?.({ ...local, status: "approved" });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Follow-up Email</span>
          <AIGeneratedBadge />
          {sent && (
            <Badge className="text-xs bg-success/10 text-success border-success/30 border">Sent</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!sent && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          {!sent && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Style signals */}
      {local.style_signals.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            Voice matched: {local.style_signals.slice(0, 3).join(" · ")}
          </p>
        </div>
      )}

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

      {/* Commitments referenced */}
      {local.commitments_referenced.length > 0 && (
        <>
          <Separator />
          <div className="px-4 py-2">
            <button
              onClick={() => setShowCommitments(!showCommitments)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCommitments ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {local.commitments_referenced.length} commitment{local.commitments_referenced.length > 1 ? "s" : ""} referenced
            </button>
            {showCommitments && (
              <ul className="mt-2 space-y-1">
                {local.commitments_referenced.map((c, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
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
          <div className="flex items-center justify-between px-4 py-3">
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
                  Done editing
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLocal(draft); setEditing(false); }}>
                  Discard edits
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Review and approve to send. Nothing leaves your org without approval.
              </p>
            )}
            {!editing && (
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleApprove} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Approve & send
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
