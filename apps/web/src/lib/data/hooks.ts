"use client";

import { useQuery } from "@tanstack/react-query";
import {
  COACHING_CANDIDATES,
  MOCK_CRM_TASKS_POST_DC,
  KB_WATCHLIST,
  COACHING_INSIGHTS,
  QUARTERLY_PATTERNS,
  CONTENT_GAPS,
} from "@/lib/mock-data";
import type { Call, CoachingInsight, KBAsset } from "@/types";
import {
  getImportVersion,
  resolveCall,
  resolveCallBrief,
  resolveCalls,
  resolvePostCallReview,
} from "@/lib/dc-data/resolvers";

const assets: KBAsset[] = [
  { id: "kb1", title: "SOC 2 Compliance Automation — Deck v3", type: "deck", tags: ["compliance", "SOC 2"], lastUsed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), effectivenessScore: 0.82, uploadedAt: "2026-01-10", version: 3 },
  { id: "kb2", title: "Delta Finance Before/After Case Study", type: "case-study", tags: ["compliance", "fintech"], effectivenessScore: 0.91, uploadedAt: "2026-02-05", version: 1 },
  { id: "kb4", title: "Legacy System Integration Playbook (2022)", type: "architecture", tags: ["legacy"], uploadedAt: "2022-03-01", version: 1 },
];

export function useCalls() {
  return useQuery({
    queryKey: ["calls", getImportVersion()],
    queryFn: async () => resolveCalls(),
    staleTime: 60_000,
  });
}

export function useCall(callId: string) {
  return useQuery({
    queryKey: ["call", callId, getImportVersion()],
    queryFn: async () => resolveCall(callId),
    staleTime: 60_000,
  });
}

export function useCallBrief(callId: string) {
  return useQuery({
    queryKey: ["call-brief", callId, getImportVersion()],
    queryFn: async () => resolveCallBrief(callId),
    staleTime: 60_000,
  });
}

export function usePostCallReview(callId: string) {
  return useQuery({
    queryKey: ["post-call", callId, getImportVersion()],
    queryFn: async () => resolvePostCallReview(callId),
    staleTime: 60_000,
  });
}

export function usePostCallCrmTasks() {
  return useQuery({
    queryKey: ["post-call-tasks", getImportVersion()],
    queryFn: async () => [] as typeof MOCK_CRM_TASKS_POST_DC,
  });
}

export function useCoachingCandidates() {
  return useQuery({ queryKey: ["coaching-candidates"], queryFn: async () => COACHING_CANDIDATES });
}

export function useCoachingInsights() {
  return useQuery({ queryKey: ["coaching-insights"], queryFn: async () => COACHING_INSIGHTS as CoachingInsight[] });
}

export function useKbAssets() {
  return useQuery({ queryKey: ["kb-assets"], queryFn: async () => assets });
}

export function useKbAsset(assetId: string) {
  return useQuery({
    queryKey: ["kb-asset", assetId],
    queryFn: async () => assets.find((a) => a.id === assetId) ?? assets[0],
  });
}

export function useKbWatchlist() {
  return useQuery({ queryKey: ["kb-watchlist"], queryFn: async () => KB_WATCHLIST });
}

export function useQuarterlyPatterns() {
  return useQuery({ queryKey: ["quarterly-patterns"], queryFn: async () => QUARTERLY_PATTERNS });
}

export function useContentGaps() {
  return useQuery({ queryKey: ["content-gaps"], queryFn: async () => CONTENT_GAPS });
}

/** Simulated SSE hook — polls live transcript slice every 3s when enabled */
export function useLiveCallStream(callId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["live-stream", callId],
    queryFn: async () => ({ connected: true, callId }),
    enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}
