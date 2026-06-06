"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

async function patchContentGap(gapKey: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/content/gaps/${encodeURIComponent(gapKey)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useDismissContentGap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input:
        | string
        | {
            gapKey: string;
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
          }
    ) => {
      if (typeof input === "string") {
        return patchContentGap(input, { status: "dismissed" });
      }
      const { gapKey, ...context } = input;
      return patchContentGap(gapKey, { ...context, status: "dismissed" });
    },
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
