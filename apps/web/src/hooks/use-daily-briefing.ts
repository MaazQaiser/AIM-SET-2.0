"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, startOfDay } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useAiTodos } from "@/hooks/use-ai-todos";
import { useCalls } from "@/lib/data/hooks";
import type { Call } from "@/types";

export interface DailyBriefingResult {
  paragraph: string;
  source: "llm" | "template";
  model?: string | null;
  cached?: boolean;
  generatedAt?: string | null;
  briefingDate?: string | null;
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

async function generateBriefing(
  payload: ReturnType<typeof buildBriefingPayload>,
  date: string,
  refresh: boolean
): Promise<DailyBriefingResult> {
  const res = await fetch(
    `/api/agents/briefing?refresh=${refresh ? "true" : "false"}&date=${encodeURIComponent(date)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error("Briefing failed");
  return res.json() as Promise<DailyBriefingResult>;
}

export function useDailyBriefing(enabled = true) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data: calls = [] } = useCalls();
  const { topOpportunityCall, pendingApprovalCount, todos } = useAiTodos();
  const briefingDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const payload = useMemo(
    () =>
      buildBriefingPayload(
        calls,
        topOpportunityCall,
        pendingApprovalCount,
        todos
      ),
    [calls, pendingApprovalCount, todos, topOpportunityCall]
  );
  const payloadSignature = useMemo(() => JSON.stringify(payload), [payload]);

  const query = useQuery({
    queryKey: ["daily-briefing", briefingDate, payloadSignature],
    queryFn: async () => generateBriefing(payload, briefingDate, true),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await generateBriefing(payload, briefingDate, true);
      queryClient.setQueryData(
        ["daily-briefing", briefingDate, payloadSignature],
        fresh
      );
      return fresh;
    } finally {
      setRefreshing(false);
    }
  }, [briefingDate, payload, payloadSignature, queryClient]);

  return {
    ...query,
    refresh,
    isRefreshing: refreshing,
  };
}
