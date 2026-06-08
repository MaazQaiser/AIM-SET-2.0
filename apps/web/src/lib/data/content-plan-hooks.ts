"use client";

import { useQuery } from "@tanstack/react-query";
import { bffFetch } from "@/lib/api/bff-fetch";
import { QUERY_STALE_TIME_MS } from "@/lib/data/query-cache";
import type { ContentPlanInput, ContentPlanResult } from "@/types/content_studio";

export function useContentPlan(input: ContentPlanInput | null) {
  return useQuery({
    queryKey: ["content-plan", input?.suggestionId, input?.title],
    queryFn: async () => {
      if (!input) return null;
      const envelope = await bffFetch<{ result: ContentPlanResult }>(
        "/api/content/plan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        45_000
      );
      return envelope?.result ?? null;
    },
    enabled: Boolean(input?.suggestionId && input?.title),
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_STALE_TIME_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
