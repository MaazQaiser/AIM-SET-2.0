"use client";

import { useMemo } from "react";
import { addHours, format, isWithinInterval } from "date-fns";
import { latestPostDcHref } from "@/lib/dashboard/call-links";
import {
  useCalls,
  useCoachingInsights,
  usePostCallTasks,
  usePreDcContentGenerationGaps,
} from "@/lib/data/hooks";
import { useClpOrgAnalytics, useLandingPage } from "@/lib/data/clp-hooks";
import {
  callOpportunityValue,
  callScheduleDate,
  todaysOpenCalls,
} from "@/lib/dashboard/call-metrics";
import { buildArtifactStudioHref } from "@/lib/content-studio/artifact-studio-href";
import type { AgentId } from "@/types/agents";

export type AiTodoAgent = AgentId;
export type AiTodoPriority = "high" | "medium" | "low";

export interface AiTodo {
  id: string;
  title: string;
  subtitle?: string;
  agent: AiTodoAgent;
  priority: AiTodoPriority;
  href: string;
}

function contentTypeLabel(type: string): string {
  if (type === "case_study") return "case study";
  if (type === "one_pager") return "one-pager";
  if (type === "demo_script") return "demo script";
  return type.replace(/_/g, " ");
}

function compactText(value: string, limit = 56): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

export function useAiTodos() {
  const { data: calls = [] } = useCalls();
  const { data: coachingInsights = [] } = useCoachingInsights();
  const { data: taskList = [] } = usePostCallTasks();
  const { data: contentGaps = [] } = usePreDcContentGenerationGaps();
  const { data: clpAnalytics } = useClpOrgAnalytics();
  const topClpAccount = clpAnalytics?.topAccounts?.[0];
  const latestCompletedCall = useMemo(
    () =>
      [...calls]
        .filter((call) => call.status === "completed")
        .sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        )[0],
    [calls]
  );
  const topClpCallId = topClpAccount?.callId ?? latestCompletedCall?.id;
  const { data: topLandingPage } = useLandingPage(topClpCallId ?? "");

  const todos = useMemo(() => {
    const items: AiTodo[] = [];
    const now = new Date();
    const in24h = addHours(now, 24);
    const in2h = addHours(now, 2);
    const todayCalls = todaysOpenCalls(calls, now);
    const todayCallIds = new Set(todayCalls.map((call) => call.id));
    const todayContentGaps = contentGaps.filter((gap) => todayCallIds.has(gap.callId));

    const pendingTasks = taskList.filter((t) => t.status === "pending_approval");
    if (pendingTasks.length > 0) {
      const hasFollowUp = pendingTasks.some((t) => t.task_type === "follow_up");
      items.push({
        id: "todo-task-list-batch",
        title: hasFollowUp
          ? "Approve follow-up email & tasks"
          : `Approve ${pendingTasks.length} task${pendingTasks.length > 1 ? "s" : ""}`,
        subtitle: `${pendingTasks.length} awaiting sign-off`,
        agent: "post_dc",
        priority: "high",
        href: latestPostDcHref(calls),
      });
    }

    for (const call of todayCalls) {
      const at = callScheduleDate(call);
      const lead = call.leadName
        ? `${call.leadName}${call.leadTitle ? ` · ${call.leadTitle}` : ""}`
        : call.accountName;
      const urgent =
        call.status === "live" ||
        (Number.isFinite(at.getTime()) && isWithinInterval(at, { start: now, end: in2h }));

      items.push({
        id: `todo-call-prep-${call.id}`,
        title:
          call.status === "live"
            ? `Run live cockpit for ${call.accountName}`
            : `Prep for ${call.accountName}`,
        subtitle: `${Number.isFinite(at.getTime()) ? format(at, "h:mm a") : "Today"} · ${lead}`,
        agent: "live-call",
        priority: urgent ? "high" : "medium",
        href: call.status === "live" ? `/calls/${call.id}/live` : `/calls/${call.id}`,
      });
    }

    for (const gap of todayContentGaps) {
      const type = contentTypeLabel(gap.type);
      items.push({
        id: `todo-content-${gap.id}`,
        title: `Generate ${type} for ${gap.accountName}`,
        subtitle: compactText(gap.name, 48),
        agent: "content_generation",
        priority: gap.priority <= 1 ? "high" : "medium",
        href: gap.studioHref,
      });
    }

    const callsWithAiContent = new Set(todayContentGaps.map((gap) => gap.callId));
    for (const call of todayCalls.filter((c) => !callsWithAiContent.has(c.id))) {
      items.push({
        id: `todo-deck-${call.id}`,
        title: `Prepare deck for ${call.accountName}`,
        subtitle: "Tailor proof points",
        agent: "content_generation",
        priority: "medium",
        href: buildArtifactStudioHref({
          type: "deck",
          callId: call.id,
          accountName: call.accountName,
          leadName: call.leadName,
          assetName: `${call.accountName} discovery deck`,
        }),
      });
    }

    const topClpAccountName =
      topLandingPage?.branding.accountName ??
      topClpAccount?.accountName ??
      latestCompletedCall?.accountName;
    const topClpStats = topLandingPage?.stats;
    if (topClpCallId && topLandingPage?.status === "published") {
      const activityParts = topClpStats
        ? [
            `${topClpStats.uniqueVisitors} visitor${topClpStats.uniqueVisitors === 1 ? "" : "s"}`,
            `${topClpStats.documentOpens} document open${topClpStats.documentOpens === 1 ? "" : "s"}`,
            `${topClpStats.proposalOpens} proposal view${topClpStats.proposalOpens === 1 ? "" : "s"}`,
          ]
        : ["Published lead hub", "check buyer engagement"];
      items.push({
        id: `todo-clp-activity-${topClpCallId}`,
        title: `Review lead hub activity${topClpAccountName ? ` for ${topClpAccountName}` : ""}`,
        subtitle: activityParts.slice(0, 2).join(" · "),
        agent: "post_dc",
        priority:
          (topClpStats?.unreadNotifications ?? 0) > 0 || (topClpStats?.proposalOpens ?? 0) > 0
            ? "high"
            : "medium",
        href: `/calls/${topClpCallId}/landing-page/activity`,
      });
    } else if (topClpCallId && topLandingPage?.status === "draft") {
      items.push({
        id: `todo-clp-draft-${topClpCallId}`,
        title: `Finish lead hub${topClpAccountName ? ` for ${topClpAccountName}` : ""}`,
        subtitle: "Draft lead hub",
        agent: "post_dc",
        priority: "medium",
        href: `/calls/${topClpCallId}/landing-page`,
      });
    } else if (clpAnalytics && clpAnalytics.publishedCount > 0) {
      items.push({
        id: "todo-clp-analytics",
        title: "Review lead hub analytics",
        subtitle: `${clpAnalytics.publishedCount} published · ${clpAnalytics.totalUniqueVisitors} visitor${clpAnalytics.totalUniqueVisitors === 1 ? "" : "s"} · ${clpAnalytics.totalLinkOpens} link open${clpAnalytics.totalLinkOpens === 1 ? "" : "s"}`,
        agent: "post_dc",
        priority: clpAnalytics.totalUniqueVisitors > 0 ? "medium" : "low",
        href: "/analytics/landing-pages",
      });
    }

    for (const insight of coachingInsights.filter((i) => i.priority === "high")) {
      items.push({
        id: `todo-coaching-${insight.id}`,
        title: "Review coaching pattern",
        subtitle: insight.pattern.slice(0, 72) + (insight.pattern.length > 72 ? "…" : ""),
        agent: "discovery-checklist",
        priority: "high",
        href: insight.callId ? `/calls/${insight.callId}` : "/coaching",
      });
    }

    for (const call of calls) {
      const at = new Date(call.scheduledAt);
      if (
        (call.status === "upcoming" || call.status === "live") &&
        !call.briefReady &&
        isWithinInterval(at, { start: now, end: in24h })
      ) {
        items.push({
          id: `todo-brief-${call.id}`,
          title: "Brief generating — review when ready",
          subtitle: call.accountName,
          agent: "content",
          priority: "medium",
          href: `/calls/${call.id}`,
        });
      }
    }

    const priorityOrder: Record<AiTodoPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return items;
  }, [
    calls,
    clpAnalytics,
    coachingInsights,
    contentGaps,
    latestCompletedCall,
    taskList,
    topClpAccount,
    topClpCallId,
    topLandingPage,
  ]);

  const counts = useMemo(
    () => ({
      high: todos.filter((t) => t.priority === "high").length,
      medium: todos.filter((t) => t.priority === "medium").length,
      low: todos.filter((t) => t.priority === "low").length,
    }),
    [todos]
  );

  const topOpportunityCall = useMemo(() => {
    const todayCalls = todaysOpenCalls(calls);
    if (todayCalls.length === 0) return calls.find((c) => c.status === "upcoming");
    return [...todayCalls].sort(
      (a, b) => callOpportunityValue(b) - callOpportunityValue(a)
    )[0];
  }, [calls]);

  return {
    todos,
    counts,
    pendingApprovalCount: taskList.filter((t) => t.status === "pending_approval").length,
    topOpportunityCall,
  };
}
