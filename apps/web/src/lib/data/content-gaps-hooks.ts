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
    mutationFn: (gapKey: string) => patchContentGap(gapKey, { status: "dismissed" }),
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
    mutationFn: ({ gapKey, kbAssetId }: { gapKey: string; kbAssetId: string }) =>
      patchContentGap(gapKey, { status: "resolved", kbAssetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-gaps"] });
      qc.invalidateQueries({ queryKey: ["pre-dc-content-generation-gaps"] });
      qc.invalidateQueries({ queryKey: ["post-dc-content-generation-gaps"] });
      qc.invalidateQueries({ queryKey: ["kb-assets"] });
    },
  });
}
