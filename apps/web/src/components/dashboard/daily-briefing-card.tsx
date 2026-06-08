"use client";

import { useMemo, type ReactNode } from "react";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { briefMainBody } from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import {
  callOpportunityValue,
  callScheduleDate,
  formatOpportunityValue,
  todaysOpenCalls,
  totalOpportunityValue,
} from "@/lib/dashboard/call-metrics";
import {
  useCalls,
  usePreDcContentGenerationGaps,
  type PreDcContentGenerationGap,
} from "@/lib/data/hooks";
import type { Call } from "@/types";

type ContentPrepItem = {
  callId: string;
  type: string;
  source: "ai" | "strategic";
};

type AttentionItem = {
  call: Call;
  score: number;
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  deck: "Deck",
  case_study: "Case study",
  one_pager: "One-pager",
  demo_script: "Demo script",
  battlecard: "Battlecard",
  architecture: "Architecture",
};

function contentTypeLabel(type: string, plural = false): string {
  const label = CONTENT_TYPE_LABEL[type] ?? "Content";
  if (!plural) return label;
  if (label === "Case study") return "Case studies";
  return `${label}s`;
}

function hasOpenBant(call: Call): boolean {
  const bant = call.bant;
  if (!bant) return true;
  return [bant.budget, bant.authority, bant.need, bant.timeline].some(
    (status) => status !== "confirmed"
  );
}

function buildContentPrepItems(
  todaysCalls: Call[],
  gaps: PreDcContentGenerationGap[],
  gapsLoading: boolean
): ContentPrepItem[] {
  const todayIds = new Set(todaysCalls.map((call) => call.id));
  const callTimeById = new Map(
    todaysCalls.map((call) => [call.id, callScheduleDate(call).getTime()])
  );
  const aiItems = gaps
    .filter((gap) => todayIds.has(gap.callId))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (callTimeById.get(a.callId) ?? 0) - (callTimeById.get(b.callId) ?? 0);
    })
    .map((gap): ContentPrepItem => ({
      callId: gap.callId,
      type: gap.type,
      source: "ai",
    }));

  if (aiItems.length > 0 || gapsLoading) return aiItems;

  return todaysCalls.slice(0, 3).map((call) => ({
    callId: call.id,
    type: "deck",
    source: "strategic",
  }));
}

function buildAttentionItems(
  todaysCalls: Call[],
  contentPrepItems: ContentPrepItem[]
): AttentionItem[] {
  const contentCountByCall = new Map<string, number>();
  for (const item of contentPrepItems) {
    contentCountByCall.set(item.callId, (contentCountByCall.get(item.callId) ?? 0) + 1);
  }

  return todaysCalls
    .map((call) => {
      const contentCount = contentCountByCall.get(call.id) ?? 0;
      const opportunity = callOpportunityValue(call);
      const needsBant = hasOpenBant(call);
      const score =
        opportunity / 1_000_000 +
        contentCount * 20 +
        (call.briefReady ? 0 : 16) +
        (needsBant ? 8 : 0) +
        (call.status === "live" ? 30 : 0);

      return { call, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function prepLabel(items: ContentPrepItem[], loading: boolean): string {
  if (loading && items.length === 0) return "Checking prep";
  if (items.length === 0) return "Prep clear";

  const countByType = new Map<string, number>();
  for (const item of items) {
    countByType.set(item.type, (countByType.get(item.type) ?? 0) + 1);
  }

  const [primaryType, primaryCount] = [...countByType.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0] ?? ["content", items.length];
  const primaryLabel = contentTypeLabel(primaryType, primaryCount !== 1).toLowerCase();
  const remainder = items.length - primaryCount;

  if (remainder > 0) {
    return `${items.length} prep items (${primaryCount} ${primaryLabel} + ${remainder} more)`;
  }

  return `${items.length} ${primaryLabel}`;
}

function leadFocusLabel(call?: Call): string {
  if (!call) return "No urgent lead";
  return call.leadName ? `${call.leadName} at ${call.accountName}` : call.accountName;
}

type HighlightTone = "calls" | "opportunity" | "lead" | "prep" | "ai";

const HIGHLIGHT_TONE_CLASS: Record<HighlightTone, string> = {
  calls: "bg-primary/15 text-primary dark:bg-primary/25",
  opportunity: "bg-amber-100/90 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100",
  lead: "bg-violet-100/90 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100",
  prep: "bg-emerald-100/90 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100",
  ai: "bg-blue-100/90 text-blue-950 dark:bg-blue-500/20 dark:text-blue-100",
};

function Highlight({ tone, children }: { tone: HighlightTone; children: ReactNode }) {
  return (
    <mark
      className={cn(
        "rounded px-1 py-0.5 font-bold underline decoration-foreground/35 underline-offset-2",
        HIGHLIGHT_TONE_CLASS[tone]
      )}
    >
      {children}
    </mark>
  );
}

export function DailyBriefingCard({ enabled = true }: { enabled?: boolean }) {
  const { data: calls = [] } = useCalls();
  const { data: contentGaps = [], isLoading: contentGapsLoading } =
    usePreDcContentGenerationGaps();

  const todaysCalls = useMemo(() => todaysOpenCalls(calls), [calls]);
  const totalOpportunity = useMemo(
    () => totalOpportunityValue(todaysCalls),
    [todaysCalls]
  );
  const contentPrepItems = useMemo(
    () => buildContentPrepItems(todaysCalls, contentGaps, contentGapsLoading),
    [contentGaps, contentGapsLoading, todaysCalls]
  );
  const attentionItems = useMemo(
    () => buildAttentionItems(todaysCalls, contentPrepItems),
    [contentPrepItems, todaysCalls]
  );
  const topOpportunity = todaysCalls
    .slice()
    .sort((a, b) => callOpportunityValue(b) - callOpportunityValue(a))[0];
  const leadFocus = attentionItems[0]?.call ?? topOpportunity;
  const prepText = prepLabel(contentPrepItems, contentGapsLoading);
  const aiPrepCount = contentPrepItems.filter((item) => item.source === "ai").length;
  const callsText = `${todaysCalls.length} call${todaysCalls.length === 1 ? "" : "s"}`;
  const opportunityText =
    totalOpportunity > 0 ? formatOpportunityValue(totalOpportunity) : "opportunity";
  const leadText = leadFocusLabel(leadFocus);

  const summary =
    todaysCalls.length === 0
      ? enabled
        ? "No discovery calls are scheduled for today. Use the window to clear approvals, review upcoming accounts, and create the next reusable sales assets."
        : "Dashboard data is still loading. The brief will summarize calls, opportunity, lead focus, and content prep once imports are ready."
      : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5 pt-5">
        <p className="type-kicker text-muted-foreground">Daily brief</p>

        <p
          className={cn(
            briefMainBody,
            "max-w-6xl break-words text-[1.35rem] leading-[1.55] text-foreground/90"
          )}
        >
          {summary ?? (
            <>
              <Highlight tone="calls">{callsText}</Highlight> today with{" "}
              <Highlight tone="opportunity">{opportunityText}</Highlight>{" "}
              {totalOpportunity > 0 ? "in visible opportunity" : "still needing sizing"}.{" "}
              {leadFocus ? (
                <>
                  <Highlight tone="lead">{leadText}</Highlight> needs the first prep pass.
                </>
              ) : (
                "No lead needs urgent attention yet."
              )}{" "}
              {contentGapsLoading && contentPrepItems.length === 0 ? (
                "AI is checking the content gaps now."
              ) : contentPrepItems.length > 0 ? (
                <>
                  <Highlight tone="prep">{prepText}</Highlight> should be prepared
                  {aiPrepCount > 0 ? (
                    <>
                      {" "}
                      with <Highlight tone="ai">AI suggestions</Highlight> ready
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "No deck or content gaps are flagged yet."
              )}
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
