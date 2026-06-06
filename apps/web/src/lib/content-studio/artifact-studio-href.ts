import type { PlannedArtifactType } from "@/lib/brief-types";

export function buildArtifactStudioHref(options: {
  type: PlannedArtifactType;
  callId: string;
  accountName: string;
  leadName?: string;
  assetName?: string;
}): string {
  const params = new URLSearchParams({
    template: options.type,
    account: options.accountName,
    source: "pre-dc",
    callId: options.callId,
  });
  if (options.leadName) params.set("lead", options.leadName);
  if (options.assetName) params.set("asset", options.assetName);
  return `/content?tab=suggestions&${params.toString()}`;
}
