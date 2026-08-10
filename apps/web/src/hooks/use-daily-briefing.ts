"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useAiTodos, type AiTodo } from "@/hooks/use-ai-todos";
import {
  useCalls,
  useContentManagerSidebarStats,
  usePostCallTasks,
} from "@/lib/data/hooks";
import {
  callScheduleDate,
  isCallOnDay,
  todaysOpenCalls,
} from "@/lib/dashboard/call-metrics";
import { companyRatingForCall } from "@/lib/dc-notes/icp-rating";
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
  pendingApprovalCount: number,
  todos: AiTodo[],
  postCallTasks: Array<{ status: string; task_type: string }>,
  pendingPrepItemCount: number
) {
  const todaysCalls = todaysOpenCalls(calls);
  const todayIds = new Set(todaysCalls.map((call) => call.id));
  const briefsNotReady = todaysCalls.filter((c) => !c.briefReady).length;
  const completedCallCount = calls.filter(
    (call) => call.status === "completed" && isCallOnDay(call)
  ).length;
  const highPriorityTodos = todos.filter((t) => t.priority === "high").length;
  const pendingPostDcTasks = postCallTasks.filter((task) => task.status === "pending_approval");
  const priorityCalls = [...todaysCalls]
    .sort((a, b) => {
      const score = (call: Call) =>
        (call.status === "live" ? 30 : 0) +
        (companyRatingForCall(call) >= 7 ? 24 : 0) +
        (call.briefReady ? 0 : 16) +
        (call.leadName ? 10 : 0) +
        (call.leadTitle ? 6 : 0);
      const delta = score(b) - score(a);
      if (delta !== 0) return delta;
      return callScheduleDate(a).getTime() - callScheduleDate(b).getTime();
    })
    .slice(0, 2);
  const recommendedMaterialTypes = [
    ...new Set(
      todos
        .filter(
          (todo) =>
            todo.callId &&
            todayIds.has(todo.callId) &&
            (todo.kind === "content_asset" || todo.kind === "deck")
        )
        .map((todo) => (todo.kind === "deck" ? "deck" : "recommended material"))
    ),
  ];

  return {
    todaysCallCount: todaysCalls.length,
    completedCallCount,
    pendingApprovalCount,
    pendingPostDcActionCount: pendingPostDcTasks.length,
    pendingPrepItemCount,
    briefsNotReady,
    highPriorityTodoCount: highPriorityTodos,
    priorityCalls: priorityCalls.map((call) => ({
      accountName: call.accountName,
      annualRevenue: call.annualRevenue,
      leadName: call.leadName,
      dealStage: call.dealStage,
      agentRating: companyRatingForCall(call),
    })),
    postDcActionTypes: pendingPostDcTasks.map((task) => task.task_type),
    recommendedMaterialTypes,
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
  const { pendingApprovalCount, todos } = useAiTodos();
  const { data: postCallTasks = [] } = usePostCallTasks();
  const { toGenerateCount: pendingPrepItemCount } = useContentManagerSidebarStats();
  const briefingDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const payload = useMemo(
    () =>
      buildBriefingPayload(
        calls,
        pendingApprovalCount,
        todos,
        postCallTasks,
        pendingPrepItemCount
      ),
    [calls, pendingApprovalCount, pendingPrepItemCount, postCallTasks, todos]
  );
  const payloadSignature = useMemo(() => JSON.stringify(payload), [payload]);

  const query = useQuery({
    queryKey: ["daily-briefing", briefingDate, payloadSignature],
    queryFn: async () => generateBriefing(payload, briefingDate, true),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
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
