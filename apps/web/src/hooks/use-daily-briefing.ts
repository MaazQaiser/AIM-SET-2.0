"use client";

import { useQuery } from "@tanstack/react-query";
import { isSameDay, startOfDay } from "date-fns";
import { useAiTodos } from "@/hooks/use-ai-todos";
import { useCalls } from "@/lib/data/hooks";
import type { Call } from "@/types";

export interface DailyBriefingResult {
  paragraph: string;
  source: "llm" | "template";
  model?: string | null;
}

function buildBriefingPayload(
  calls: Call[],
  topOpportunityCall: ReturnType<typeof useAiTodos>["topOpportunityCall"],
  pendingApprovalCount: number,
  todos: ReturnType<typeof useAiTodos>["todos"]
) {
  const today = startOfDay(new Date());
  const todaysCalls = calls.filter(
    (c) =>
      (c.status === "upcoming" || c.status === "live") &&
      isSameDay(new Date(c.scheduledAt), today)
  );
  const briefsNotReady = todaysCalls.filter((c) => !c.briefReady).length;
  const highPriorityTodos = todos.filter((t) => t.priority === "high").length;

  return {
    todaysCallCount: todaysCalls.length,
    pendingApprovalCount,
    briefsNotReady,
    highPriorityTodoCount: highPriorityTodos,
    topOpportunity: topOpportunityCall
      ? {
          accountName: topOpportunityCall.accountName,
          annualRevenue: topOpportunityCall.annualRevenue,
          leadName: topOpportunityCall.leadName,
          dealStage: topOpportunityCall.dealStage,
        }
      : null,
    todos: todos.slice(0, 12).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
    })),
  };
}

export function useDailyBriefing(enabled = true) {
  const { data: calls = [] } = useCalls();
  const { topOpportunityCall, pendingApprovalCount, todos } = useAiTodos();
  const payload = buildBriefingPayload(
    calls,
    topOpportunityCall,
    pendingApprovalCount,
    todos
  );

  return useQuery({
    queryKey: ["daily-briefing", payload],
    queryFn: async () => {
      const res = await fetch("/api/agents/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Briefing failed");
      }
      return res.json() as Promise<DailyBriefingResult>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
