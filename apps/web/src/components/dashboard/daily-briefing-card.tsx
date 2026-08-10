"use client";

import { useMemo, type ReactNode } from "react";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { briefMainBody } from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import {
  callScheduleDate,
  isCallOnDay,
  todaysOpenCalls,
} from "@/lib/dashboard/call-metrics";
import { companyRatingForCall, icpScoreFromBucket } from "@/lib/dc-notes/icp-rating";
import {
  useCalls,
  useContentManagerSidebarStats,
  usePostCallTasks,
  usePreDcContentGenerationGaps,
  type PreDcContentGenerationGap,
} from "@/lib/data/hooks";
import type { Call } from "@/types";

type ContentPrepItem = {
  callId: string;
  type: string;
  source: "ai";
};

type AttentionItem = {
  call: Call;
  agentRating: number;
  score: number;
};

const CLOSE_ICP_MATCH_THRESHOLD = 0.78;

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

function callIcpFitScore(call: Call): number {
  if (typeof call.icpMatch === "number" && Number.isFinite(call.icpMatch)) {
    return call.icpMatch;
  }

  return icpScoreFromBucket(call.icpBucket ?? "");
}

function hasCloseIcpMatch(call: Call): boolean {
  return callIcpFitScore(call) >= CLOSE_ICP_MATCH_THRESHOLD;
}

function buildContentPrepItems(
  todaysCalls: Call[],
  gaps: PreDcContentGenerationGap[]
): ContentPrepItem[] {
  const todayIds = new Set(todaysCalls.map((call) => call.id));
  const callTimeById = new Map(
    todaysCalls.map((call) => [call.id, callScheduleDate(call).getTime()])
  );

  return gaps
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
      const needsBant = hasOpenBant(call);
      const agentRating = companyRatingForCall(call);
      const closeIcpMatch = hasCloseIcpMatch(call);
      const score =
        contentCount * 20 +
        (agentRating >= 7 ? 24 : 0) +
        (closeIcpMatch ? 18 : 0) +
        (call.briefReady ? 0 : 16) +
        (needsBant ? 8 : 0) +
        (call.status === "live" ? 30 : 0) +
        (call.leadName ? 10 : 0) +
        (call.leadTitle ? 6 : 0);

      return { call, agentRating, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return callScheduleDate(a.call).getTime() - callScheduleDate(b.call).getTime();
    })
    .slice(0, 3);
}

type HighlightTone = "calls" | "lead" | "postDc" | "prep" | "ai";

const HIGHLIGHT_TONE_CLASS: Record<HighlightTone, string> = {
  calls: "bg-primary/15 text-primary dark:bg-primary/25",
  lead: "bg-violet-100/90 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100",
  postDc: "bg-amber-100/90 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100",
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

function joinList(items: string[]): string {
  const unique = [...new Set(items.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function priorityReasonText(items: AttentionItem[], contentPrepItems: ContentPrepItem[]): string {
  if (items.length === 0) return "they are nearest on the calendar";

  const callIds = new Set(items.map((item) => item.call.id));
  const hasMaterialPrep = contentPrepItems.some((item) => callIds.has(item.callId));
  const hasStrongAgentRating = items.some((item) => item.agentRating >= 7);
  const hasCloseIcp = items.some((item) => hasCloseIcpMatch(item.call));
  const hasBriefReview = items.some((item) => !item.call.briefReady);
  const hasDiscoveryGaps = items.some((item) => hasOpenBant(item.call));
  const hasLiveCall = items.some((item) => item.call.status === "live");
  const plural = items.length > 1;
  const signals: string[] = [];

  if (hasStrongAgentRating) {
    signals.push(plural ? "carry agent rating 7+ signals" : "carries an agent rating of 7+");
  }
  if (hasCloseIcp) signals.push(plural ? "have close ICP match" : "has close ICP match");
  if (hasLiveCall) signals.push(plural ? "are live or starting soon" : "is live or starting soon");
  if (hasMaterialPrep) {
    signals.push(plural ? "have material recommendations pending" : "has a material recommendation pending");
  }
  if (hasBriefReview) signals.push(plural ? "still need brief review" : "still needs brief review");
  if (hasDiscoveryGaps) {
    signals.push(plural ? "have discovery gaps to cover" : "has discovery gaps to cover");
  }

  if (signals.length === 0) {
    return plural ? "they are nearest on the calendar" : "it is nearest on the calendar";
  }

  return `${plural ? "they" : "it"} ${joinList(signals.slice(0, 2))}`;
}

function postDcActionLabels(taskTypes: string[]): string {
  const labels = taskTypes.map((type) => {
    if (type === "follow_up") return "send follow-up";
    if (type === "content_request") return "send requested material";
    if (type === "schedule_next_meeting") return "schedule next meeting";
    if (type === "internal_review") return "complete internal review";
    return "confirm next steps";
  });

  return joinList(labels.slice(0, 3)) || "confirm next steps";
}

function materialRecommendation(items: ContentPrepItem[], loading: boolean): string {
  if (loading && items.length === 0) {
    return "AI is checking material recommendations for your priority calls.";
  }

  if (items.length === 0) {
    return "AI has no new material recommendation for priority calls.";
  }

  const labels = joinList(
    [...new Set(items.map((item) => contentTypeLabel(item.type).toLowerCase()))].slice(0, 2)
  );

  return `AI recommends ${labels} for your priority calls.`;
}

function overallPrepLine({
  count,
  loading,
  label,
}: {
  count: number;
  loading: boolean;
  label: string;
}): ReactNode {
  if (loading) return "Overall prep creation count is still being checked.";
  if (count === 0) return "Overall, no prep items are pending creation.";

  return (
    <>
      Overall, <Highlight tone="prep">{label}</Highlight> {count === 1 ? "is" : "are"} still
      pending creation.
    </>
  );
}

export function DailyBriefingCard({ enabled = true }: { enabled?: boolean }) {
  const { data: calls = [] } = useCalls();
  const { data: postCallTasks = [] } = usePostCallTasks();
  const { data: contentGaps = [], isLoading: contentGapsLoading } =
    usePreDcContentGenerationGaps();
  const {
    toGenerateCount: overallPrepCount,
    isLoading: overallPrepLoading,
  } = useContentManagerSidebarStats();

  const todaysCalls = useMemo(() => todaysOpenCalls(calls), [calls]);
  const completedTodayCount = useMemo(
    () => calls.filter((call) => call.status === "completed" && isCallOnDay(call)).length,
    [calls]
  );
  const contentPrepItems = useMemo(
    () => buildContentPrepItems(todaysCalls, contentGaps),
    [contentGaps, todaysCalls]
  );
  const attentionItems = useMemo(
    () => buildAttentionItems(todaysCalls, contentPrepItems),
    [contentPrepItems, todaysCalls]
  );
  const pendingPostDcActions = useMemo(
    () => postCallTasks.filter((task) => task.status === "pending_approval"),
    [postCallTasks]
  );
  const priorityItems = attentionItems.slice(0, 2);
  const priorityText = joinList(priorityItems.map((item) => item.call.accountName));
  const callsText = `${todaysCalls.length} call${todaysCalls.length === 1 ? "" : "s"}`;
  const postDcText = `${pendingPostDcActions.length} post-DC action${
    pendingPostDcActions.length === 1 ? "" : "s"
  }`;
  const pendingPrepText = `${overallPrepCount} prep item${
    overallPrepCount === 1 ? "" : "s"
  }`;
  const recommendationText = materialRecommendation(contentPrepItems, contentGapsLoading);
  const postDcLabels = postDcActionLabels(
    pendingPostDcActions.map((task) => task.task_type)
  );
  const overallPrep = overallPrepLine({
    count: overallPrepCount,
    loading: overallPrepLoading,
    label: pendingPrepText,
  });

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
          {!enabled ? (
            "Dashboard data is still loading. The brief will summarize calls, post-DC actions, and material creation once imports are ready."
          ) : todaysCalls.length === 0 ? (
            <>
              No calls are scheduled in the brief window. Use the time to clear post-DC actions, review
              completed discovery notes, and create pending materials.{" "}
              {overallPrep}
            </>
          ) : (
            <>
              You have <Highlight tone="calls">{callsText}</Highlight> in focus.{" "}
              {priorityItems.length > 0 ? (
                <>
                  Prioritize <Highlight tone="lead">{priorityText}</Highlight> because{" "}
                  {priorityReasonText(priorityItems, contentPrepItems)}.
                </>
              ) : (
                "No call needs special attention yet."
              )}{" "}
              {pendingPostDcActions.length > 0 ? (
                <>
                  From completed discovery calls, <Highlight tone="postDc">{postDcText}</Highlight>{" "}
                  {pendingPostDcActions.length === 1 ? "is" : "are"} pending: {postDcLabels}.
                </>
              ) : completedTodayCount > 0 ? (
                <>
                  From completed discovery calls,{" "}
                  <Highlight tone="postDc">no post-DC actions</Highlight> are pending right now.
                </>
              ) : (
                "No completed discovery calls need post-DC follow-up yet."
              )}{" "}
              <Highlight tone="ai">{recommendationText}</Highlight> {overallPrep}
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
