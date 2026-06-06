export interface SuggestionProjectInput {
  title: string;
  artifactType: string;
  callId?: string;
  gapId?: string;
  accountName?: string;
  leadName?: string;
  reason?: string;
  neededFor?: string;
  industry?: string;
  source?: "pre-dc" | "post-dc";
}

function mapArtifactType(type: string): "deck" | "one_pager" | "image" {
  const normalized = type.toLowerCase().replace(/-/g, "_");
  if (normalized.includes("one") || normalized === "one_pager") return "one_pager";
  if (normalized.includes("image")) return "image";
  return "deck";
}

/** Creates a Studio project pre-seeded from a content suggestion and returns its id. */
export async function createProjectFromSuggestion(input: SuggestionProjectInput): Promise<string> {
  const artifactType = mapArtifactType(String(input.artifactType));
  const brief: Record<string, unknown> = {
    artifact_type: artifactType,
    account_name: input.accountName,
    lead_name: input.leadName,
    call_id: input.callId,
    gap_id: input.gapId,
    source: input.source,
    generation_reason: input.reason,
    needed_for: input.neededFor,
    asset_name: input.title,
    industry: input.industry,
  };

  const createRes = await fetch("/api/content/studio/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      artifactType,
      brief,
      callId: input.callId,
      gapId: input.gapId,
    }),
  });
  if (!createRes.ok) {
    throw new Error(await createRes.text());
  }
  const project = (await createRes.json()) as { id: string };
  return project.id;
}
