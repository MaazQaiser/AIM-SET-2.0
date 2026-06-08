"use client";

import { useMemo, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
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

function Highlight({ children }: { children: ReactNode }) {
  return (
    <span className="font-semibold text-foreground underline decoration-warning/45 decoration-2 underline-offset-4">
      {children}
    </span>
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 shrink-0 text-warning" />
            <span className="type-title text-foreground">Daily brief</span>
          </div>
        </div>

        <p className="max-w-5xl type-section-title leading-relaxed text-foreground">
          {summary ?? (
            <>
              <Highlight>{callsText}</Highlight> today with{" "}
              <Highlight>{opportunityText}</Highlight>{" "}
              {totalOpportunity > 0 ? "in visible opportunity" : "still needing sizing"}.{" "}
              {leadFocus ? (
                <>
                  <Highlight>{leadText}</Highlight> needs the first prep pass.
                </>
              ) : (
                "No lead needs urgent attention yet."
              )}{" "}
              {contentGapsLoading && contentPrepItems.length === 0 ? (
                "AI is checking the content gaps now."
              ) : contentPrepItems.length > 0 ? (
                <>
                  <Highlight>{prepText}</Highlight> should be prepared
                  {aiPrepCount > 0 ? (
                    <>
                      {" "}
                      with <Highlight>AI suggestions</Highlight> ready
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
