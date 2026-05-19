"use client";

import { useMemo } from "react";
import { addHours, isWithinInterval } from "date-fns";
import { useCalls, useCoachingInsights } from "@/lib/data/hooks";
import { MOCK_CRM_TASKS_POST_DC } from "@/lib/mock-data";
import type { Call } from "@/types";

export type AiTodoAgent = "live-call" | "content" | "coaching" | "task";
export type AiTodoPriority = "high" | "medium" | "low";

export interface AiTodo {
  id: string;
  title: string;
  subtitle?: string;
  agent: AiTodoAgent;
  priority: AiTodoPriority;
  href: string;
}

function parseRevenue(raw?: string): number {
  if (!raw) return 0;
  const m = raw.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

export function useAiTodos() {
  const { data: calls = [] } = useCalls();
  const { data: coachingInsights = [] } = useCoachingInsights();

  const todos = useMemo(() => {
    const items: AiTodo[] = [];
    const now = new Date();
    const in24h = addHours(now, 24);
    const in2h = addHours(now, 2);

    const pendingCrm = MOCK_CRM_TASKS_POST_DC.filter(
      (t) => t.status === "pending_approval"
    );
    if (pendingCrm.length > 0) {
      const hasFollowUp = pendingCrm.some((t) => t.task_type === "follow_up");
      items.push({
        id: "todo-crm-batch",
        title: hasFollowUp
          ? "Approve follow-up email & CRM tasks"
          : `Approve ${pendingCrm.length} CRM task${pendingCrm.length > 1 ? "s" : ""}`,
        subtitle: `${pendingCrm.length} item${pendingCrm.length > 1 ? "s" : ""} · Task Agent · awaiting sign-off`,
        agent: "task",
        priority: "high",
        href: "/calls/call-001?tab=post-dc",
      });
    }

    for (const insight of coachingInsights.filter((i) => i.priority === "high")) {
      items.push({
        id: `todo-coaching-${insight.id}`,
        title: "Review coaching pattern",
        subtitle: insight.pattern.slice(0, 72) + (insight.pattern.length > 72 ? "…" : ""),
        agent: "coaching",
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

    for (const call of calls) {
      const at = new Date(call.scheduledAt);
      if (
        (call.status === "upcoming" || call.status === "live") &&
        isWithinInterval(at, { start: now, end: in2h })
      ) {
        const lead = call.leadName
          ? `${call.leadName}${call.leadTitle ? ` · ${call.leadTitle}` : ""}`
          : call.accountName;
        items.push({
          id: `todo-prep-${call.id}`,
          title: `Prep for ${call.accountName}`,
          subtitle: lead,
          agent: "live-call",
          priority: "high",
          href: call.status === "live" ? `/calls/${call.id}/live` : `/calls/${call.id}`,
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
  }, [calls, coachingInsights]);

  const counts = useMemo(
    () => ({
      high: todos.filter((t) => t.priority === "high").length,
      medium: todos.filter((t) => t.priority === "medium").length,
      low: todos.filter((t) => t.priority === "low").length,
    }),
    [todos]
  );

  const topOpportunityCall = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayCalls = calls.filter((c) => {
      const d = new Date(c.scheduledAt);
      return (
        (c.status === "upcoming" || c.status === "live") &&
        d >= todayStart &&
        d <= todayEnd
      );
    });
    if (todayCalls.length === 0) return calls.find((c) => c.status === "upcoming");
    return [...todayCalls].sort(
      (a, b) => parseRevenue(b.annualRevenue) - parseRevenue(a.annualRevenue)
    )[0];
  }, [calls]);

  return {
    todos,
    counts,
    pendingApprovalCount: MOCK_CRM_TASKS_POST_DC.filter(
      (t) => t.status === "pending_approval"
    ).length,
    topOpportunityCall,
  };
}
