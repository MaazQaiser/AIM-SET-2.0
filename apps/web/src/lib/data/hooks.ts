"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { bffFetch } from "@/lib/api/bff-fetch";
import type {
  Call,
  CoachingInsight,
  ContentGap,
  CoachingCandidate,
  KbWatchlistItem,
  KBAsset,
  QuarterlyPattern,
} from "@/types";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";
import {
  FRANCHISE_DEMO_CALL_ID,
  franchiseDemoPostReview,
  mergeFranchiseDemoCalls,
} from "@/lib/demo/franchise-ai-platform-demo";
import {
  getImportVersion,
  resolveCall,
  resolveCallBrief,
  resolveCalls,
  resolvePostCallReview,
} from "@/lib/dc-data/resolvers";
import type { CrmTask } from "@/components/post-dc/crm-task-list";
import type { ActivityEvent, AgentRun } from "@/types/agents";

const REFETCH_MS = 30_000;

async function fetchCallsFromApi(): Promise<Call[]> {
  const api = await bffFetch<Call[]>("/api/calls");
  if (api && api.length > 0) return mergeFranchiseDemoCalls(api);
  return resolveCalls();
}

export function useCalls() {
  return useQuery({
    queryKey: ["calls", getImportVersion()],
    queryFn: fetchCallsFromApi,
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useCall(callId: string) {
  return useQuery({
    queryKey: ["call", callId, getImportVersion()],
    queryFn: async () => {
      const api = await bffFetch<Call>(`/api/calls/${callId}`);
      if (api) return api;
      const local = resolveCall(callId);
      if (!local) throw new Error(`Call not found: ${callId}`);
      return local;
    },
    staleTime: REFETCH_MS,
  });
}

export function useCallBrief(callId: string) {
  return useQuery({
    queryKey: ["call-brief", callId, getImportVersion()],
    queryFn: async () => {
      const api = await bffFetch<CallBrief>(`/api/calls/${callId}/brief`);
      if (api) return api;
      return resolveCallBrief(callId);
    },
    staleTime: REFETCH_MS,
  });
}

export function usePostCallReview(callId: string) {
  return useQuery({
    queryKey: ["post-call", callId, getImportVersion()],
    queryFn: async () => {
      const base = resolvePostCallReview(callId);
      const snap =
        useDcImportsStore.getState().discoverySnapshotsByCallId[callId] ??
        (callId === FRANCHISE_DEMO_CALL_ID
          ? {
              openGaps: franchiseDemoPostReview.openDiscoveryGaps ?? [],
              bantCoverage: franchiseDemoPostReview.discoveryBantCoverage,
            }
          : undefined);
      if (!base && !snap) return null;
      const merged = base ?? {
        headline: "Post-call review",
        summary: [],
        podScorecard: [],
        learned: [],
      };
      return {
        ...merged,
        openDiscoveryGaps: snap?.openGaps?.length
          ? snap.openGaps
          : merged.openDiscoveryGaps,
        discoveryBantCoverage:
          snap?.bantCoverage ?? merged.discoveryBantCoverage,
      };
    },
    staleTime: REFETCH_MS,
  });
}

export function useRunPostCallPipeline(callId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calls/${callId}/post-call`, { method: "POST" });
      if (!res.ok) throw new Error("Post-call pipeline failed");
      return res.json() as Promise<{
        discovery?: { result?: { openGaps?: string[]; checklist?: { bantCoverage?: number } } };
      }>;
    },
    onSuccess: (data) => {
      const result = data.discovery?.result ?? data.discovery;
      const openGaps = (result as { openGaps?: string[] })?.openGaps ?? [];
      const checklist = (result as { checklist?: { bantCoverage?: number } })?.checklist;
      useDcImportsStore.getState().setDiscoverySnapshot(callId, {
        openGaps,
        bantCoverage: checklist?.bantCoverage,
      });
      void queryClient.invalidateQueries({ queryKey: ["post-call", callId] });
    },
  });
}

export function usePostCallCrmTasks() {
  return useQuery({
    queryKey: ["post-call-tasks", getImportVersion()],
    queryFn: async () => [] as CrmTask[],
    staleTime: REFETCH_MS,
  });
}

export function useCoachingCandidates() {
  return useQuery({
    queryKey: ["coaching-candidates"],
    queryFn: async () => {
      const api = await bffFetch<CoachingCandidate[]>("/api/coaching/candidates");
      return api ?? [];
    },
    staleTime: REFETCH_MS,
  });
}

export function useCoachingInsights() {
  return useQuery({
    queryKey: ["coaching-insights"],
    queryFn: async () => {
      const api = await bffFetch<CoachingInsight[]>("/api/coaching/insights");
      return api ?? [];
    },
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useKbAssets() {
  return useQuery({
    queryKey: ["kb-assets"],
    queryFn: async () => {
      const res = await fetch("/api/kb/assets", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`KB assets request failed (${res.status})`);
      }
      return res.json() as Promise<KBAsset[]>;
    },
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useKbAsset(assetId: string) {
  return useQuery({
    queryKey: ["kb-asset", assetId],
    queryFn: async () => {
      const api = await bffFetch<KBAsset>(`/api/kb/assets/${assetId}`);
      if (api) return api;
      throw new Error(`Asset not found: ${assetId}`);
    },
    staleTime: REFETCH_MS,
  });
}

export function useKbWatchlist() {
  return useQuery({
    queryKey: ["kb-watchlist"],
    queryFn: async () => {
      const api = await bffFetch<KbWatchlistItem[]>("/api/kb/watchlist");
      return api ?? [];
    },
    staleTime: REFETCH_MS,
  });
}

export function useQuarterlyPatterns() {
  return useQuery({
    queryKey: ["quarterly-patterns"],
    queryFn: async () => {
      const api = await bffFetch<QuarterlyPattern[]>("/api/coaching/quarterly-patterns");
      return api ?? [];
    },
    staleTime: REFETCH_MS,
  });
}

export function useContentGaps() {
  return useQuery({
    queryKey: ["content-gaps"],
    queryFn: async () => {
      const api = await bffFetch<ContentGap[]>("/api/content/gaps");
      return api ?? [];
    },
    staleTime: REFETCH_MS,
  });
}

export function useAgentRuns() {
  return useQuery({
    queryKey: ["agent-runs"],
    queryFn: async () => {
      const api = await bffFetch<AgentRun[]>("/api/agents/runs");
      return api ?? [];
    },
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useAgentAudit() {
  return useQuery({
    queryKey: ["agent-audit"],
    queryFn: async () => {
      const api = await bffFetch<ActivityEvent[]>("/api/agents/audit");
      return api ?? [];
    },
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
}

export function useLiveCallStream(callId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["live-stream", callId],
    queryFn: async () => ({ connected: true, callId }),
    enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}
