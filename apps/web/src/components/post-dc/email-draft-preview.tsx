"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { PostCallEmailDraft } from "@/lib/brief-types";

interface EmailDraftPreviewProps {
  draft: PostCallEmailDraft;
  showCopy?: boolean;
}

export function formatEmailDraftForCopy(draft: PostCallEmailDraft) {
  return [
    `To: ${draft.to.join(", ")}`,
    ...(draft.cc?.length ? [`CC: ${draft.cc.join(", ")}`] : []),
    `Subject: ${draft.subject}`,
    "",
    draft.body_markdown.trim(),
  ].join("\n");
}

/** Compact email preview for the Overview card — full editor opens in expand modal. */
export function EmailDraftPreview({ draft, showCopy = true }: EmailDraftPreviewProps) {
  const [copied, setCopied] = useState(false);
  const bodyLines = draft.body_markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  async function handleCopy() {
    const ok = await copyTextToClipboard(formatEmailDraftForCopy(draft));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-sm">
      {showCopy ? (
        <div className="flex justify-end -mt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => void handleCopy()}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy email"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy full email text</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To</p>
        <p className="text-xs text-foreground break-words">{draft.to.join(", ")}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
        <p className="text-xs font-medium text-foreground break-words">{draft.subject}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Body</p>
        <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words line-clamp-[10]">
          {bodyLines.join("\n")}
          {draft.body_markdown.split("\n").filter((l) => l.trim()).length > bodyLines.length ? "\n…" : ""}
        </div>
      </div>
    </div>
  );
}
