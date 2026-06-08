"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ContentGap } from "@/types";

async function patchContentGap(gapKey: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/content/gaps/${encodeURIComponent(gapKey)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type DismissContext = {
  source?: "pre-dc" | "post-dc";
  name?: string;
  artifactType?: string;
  callId?: string;
  reason?: string;
  neededFor?: string;
  sourcePath?: string;
  contentRequirements?: string;
  context?: Record<string, unknown>;
  priority?: number;
};

export type DismissContentGapInput =
  | string
  | ({ gapKey: string } & DismissContext)
  | ({ gapKeys: string[] } & DismissContext);

function normalizeDismissInput(input: DismissContentGapInput): Array<{ gapKey: string; payload: DismissContext }> {
  if (typeof input === "string") {
    return [{ gapKey: input, payload: {} }];
  }
  if ("gapKeys" in input && input.gapKeys.length > 0) {
    const { gapKeys, ...payload } = input;
    return gapKeys.map((gapKey) => ({ gapKey, payload }));
  }
  const { gapKey, ...payload } = input;
  return [{ gapKey, payload }];
}

function optimisticallyDismissGaps(
  gaps: ContentGap[] | undefined,
  entries: Array<{ gapKey: string; payload: DismissContext }>
): ContentGap[] {
  const next = [...(gaps ?? [])];
  for (const { gapKey, payload } of entries) {
    const idx = next.findIndex((gap) => gap.gapKey === gapKey);
    const patch: Partial<ContentGap> = {
      gapKey,
      workflowStatus: "dismissed",
      topic: payload.name ?? next[idx]?.topic ?? gapKey,
      callId: payload.callId ?? next[idx]?.callId,
      sourcePath: payload.sourcePath ?? next[idx]?.sourcePath,
      reason: payload.reason ?? next[idx]?.reason,
      neededFor: payload.neededFor ?? next[idx]?.neededFor,
      artifactType: payload.artifactType ?? next[idx]?.artifactType,
    };
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...patch };
      continue;
    }
    next.push({
      id: gapKey,
      gapKey,
      workflowStatus: "dismissed",
      topic: payload.name ?? gapKey,
      sourcedFrom: payload.source === "post-dc" ? "Post-DC wrap-up" : "Pre-DC workflow",
      callId: payload.callId,
      sourcePath: payload.sourcePath,
      reason: payload.reason,
      neededFor: payload.neededFor,
      artifactType: payload.artifactType,
      status: "pending-review",
      draftType: "deck",
    });
  }
  return next;
}

export function useDismissContentGap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DismissContentGapInput) => {
      const entries = normalizeDismissInput(input);
      await Promise.all(
        entries.map(({ gapKey, payload }) => patchContentGap(gapKey, { ...payload, status: "dismissed" }))
      );
      return entries.map((entry) => entry.gapKey);
    },
    onMutate: async (input) => {
      const entries = normalizeDismissInput(input);
      await qc.cancelQueries({ queryKey: ["content-gaps"] });
      const previous = qc.getQueryData<ContentGap[]>(["content-gaps"]);
      qc.setQueryData(["content-gaps"], optimisticallyDismissGaps(previous, entries));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(["content-gaps"], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["content-gaps"] });
      qc.invalidateQueries({ queryKey: ["pre-dc-content-generation-gaps"] });
      qc.invalidateQueries({ queryKey: ["post-dc-content-generation-gaps"] });
    },
  });
}

export function useTrackContentGap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      gapKey,
      studioProjectId,
      ...context
    }: {
      gapKey: string;
      studioProjectId: string;
      source?: "pre-dc" | "post-dc";
      name?: string;
      artifactType?: string;
      callId?: string;
      reason?: string;
      neededFor?: string;
      sourcePath?: string;
      contentRequirements?: string;
      context?: Record<string, unknown>;
      priority?: number;
    }) =>
      patchContentGap(gapKey, {
        ...context,
        status: "in_progress",
        studioProjectId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-gaps"] });
      qc.invalidateQueries({ queryKey: ["pre-dc-content-generation-gaps"] });
      qc.invalidateQueries({ queryKey: ["post-dc-content-generation-gaps"] });
    },
  });
}

export function useResolveContentGap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      gapKey,
      kbAssetId,
      ...context
    }: {
      gapKey: string;
      kbAssetId: string;
      source?: "pre-dc" | "post-dc";
      name?: string;
      artifactType?: string;
      callId?: string;
      reason?: string;
      neededFor?: string;
      sourcePath?: string;
      contentRequirements?: string;
      context?: Record<string, unknown>;
      priority?: number;
    }) =>
      patchContentGap(gapKey, {
        ...context,
        status: "resolved",
        kbAssetId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-gaps"] });
      qc.invalidateQueries({ queryKey: ["pre-dc-content-generation-gaps"] });
      qc.invalidateQueries({ queryKey: ["post-dc-content-generation-gaps"] });
      qc.invalidateQueries({ queryKey: ["kb-assets"] });
    },
  });
}
