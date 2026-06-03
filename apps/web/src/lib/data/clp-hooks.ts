"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bffFetch } from "@/lib/api/bff-fetch";
import type {
  ClpActivityRollup,
  ClpOrgAnalytics,
  ClpNotification,
  ClpProposal,
  CustomerLandingPage,
} from "@dc-copilot/types";

export function useLandingPage(callId: string) {
  return useQuery({
    queryKey: ["landing-page", callId],
    queryFn: () => bffFetch<CustomerLandingPage>(`/api/calls/${callId}/landing-page`),
    enabled: Boolean(callId),
  });
}

export function useGenerateLandingPage(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calls/${callId}/landing-page/generate`, { method: "POST" });
      if (!res.ok) throw new Error("Generate failed");
      return res.json() as Promise<CustomerLandingPage>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing-page", callId] }),
  });
}

export function useUpdateLandingPage(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<CustomerLandingPage>) => {
      const res = await fetch(`/api/calls/${callId}/landing-page`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json() as Promise<CustomerLandingPage>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing-page", callId] }),
  });
}

export function usePublishLandingPage(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch(`/api/calls/${callId}/landing-page/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Publish failed");
      return res.json() as Promise<CustomerLandingPage>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-page", callId] });
      qc.invalidateQueries({ queryKey: ["landing-page-activity", callId] });
    },
  });
}

export function useLandingPageActivity(callId: string) {
  return useQuery({
    queryKey: ["landing-page-activity", callId],
    queryFn: () => bffFetch<ClpActivityRollup>(`/api/calls/${callId}/landing-page/activity`),
    enabled: Boolean(callId),
  });
}

export function useGenerateClpProposal(callId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calls/${callId}/landing-page/proposal/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Proposal generate failed");
      return res.json() as Promise<ClpProposal>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing-page", callId] }),
  });
}

export function useClpProposal(callId: string) {
  return useQuery({
    queryKey: ["clp-proposal", callId],
    queryFn: () => bffFetch<ClpProposal>(`/api/calls/${callId}/landing-page/proposal`),
    enabled: Boolean(callId),
  });
}

export function useClpNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: ["clp-notifications", unreadOnly],
    queryFn: () =>
      bffFetch<ClpNotification[]>(`/api/notifications${unreadOnly ? "?unread_only=true" : ""}`),
  });
}

export function useClpOrgAnalytics() {
  return useQuery({
    queryKey: ["clp-org-analytics"],
    queryFn: () => bffFetch<ClpOrgAnalytics>("/api/analytics/landing-pages"),
  });
}
