import type { ContentPlanInput, ContentPlanResult, SuggestionPlan } from "@/types/content_studio";
import type { SuggestionKbMatch } from "@/lib/content/suggestion-context";
import type { ContentGenerationLead } from "@/lib/content/group-pre-dc-gaps";

export interface SuggestionProjectInput {
  title: string;
  artifactType: string;
  suggestionId: string;
  callId?: string;
  gapId?: string;
  accountName?: string;
  leadName?: string;
  reason?: string;
  neededFor?: string;
  sourcePath?: string;
  contentRequirements?: string;
  context?: Record<string, unknown>;
  industry?: string;
  source?: "pre-dc" | "post-dc";
  leads?: ContentGenerationLead[];
  kbMatches?: SuggestionKbMatch[];
  sourceArtifactId?: string;
}

function mapArtifactType(type: string): "deck" | "one_pager" | "image" {
  const normalized = type.toLowerCase().replace(/-/g, "_");
  if (normalized.includes("one") || normalized === "one_pager") return "one_pager";
  if (normalized.includes("image")) return "image";
  return "deck";
}

/** Fetch proactive content plan from backend evidence planner. */
export async function fetchContentPlan(input: ContentPlanInput): Promise<SuggestionPlan> {
  const res = await fetch("/api/content/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const envelope = (await res.json()) as { result?: ContentPlanResult };
  const plan = envelope.result?.suggestion_plan;
  if (!plan) {
    throw new Error("Content plan missing from response");
  }
  return plan;
}

/** Creates a Studio project pre-seeded from a content suggestion and returns its id. */
export async function createProjectFromSuggestion(input: SuggestionProjectInput): Promise<string> {
  const artifactType = mapArtifactType(String(input.artifactType));
  const leads = (input.leads ?? []).map((lead) => ({
    callId: lead.callId,
    accountName: lead.accountName,
    leadName: lead.leadName,
    industry: lead.industry ?? input.industry,
    sourcePath: lead.sourcePath,
    contentRequirements: lead.contentRequirements,
    context: lead.context,
    relevantProjects: lead.relevantProjects,
    relevantDocuments: lead.relevantDocuments,
    recommendedDeck: lead.recommendedDeck,
  }));
  const sourcePath =
    input.sourcePath || input.leads?.find((lead) => lead.sourcePath)?.sourcePath || "/content?tab=suggestions";
  const contentRequirements =
    input.contentRequirements ||
    input.leads?.find((lead) => lead.contentRequirements)?.contentRequirements ||
    input.reason ||
    input.neededFor ||
    "";
  const suggestionContext = {
    ...(input.context ?? {}),
    source: input.source,
    sourcePath,
    suggestionId: input.suggestionId,
    gapId: input.gapId,
    title: input.title,
    artifactType,
    accountName: input.accountName,
    leadName: input.leadName,
    industry: input.industry,
    reason: input.reason,
    neededFor: input.neededFor,
    contentRequirements,
    kbMatches: input.kbMatches ?? [],
    leads,
  };

  let suggestionPlan: SuggestionPlan | undefined;
  try {
    suggestionPlan = await fetchContentPlan({
      suggestionId: input.suggestionId,
      title: input.title,
      artifactType,
      source: input.source,
      generationReason: input.reason,
      neededFor: input.neededFor,
      sourcePath,
      contentRequirements,
      context: suggestionContext,
      industry: input.industry,
      leads,
      kbAssetIds: (input.kbMatches ?? []).map((m) => m.id),
    });
  } catch {
    suggestionPlan = undefined;
  }

  const brief: Record<string, unknown> = {
    artifact_type: artifactType,
    account_name: input.accountName,
    lead_name: input.leadName,
    call_id: input.callId,
    gap_id: input.gapId,
    source: input.source,
    generation_reason: input.reason,
    needed_for: input.neededFor,
    source_path: sourcePath,
    content_requirements: contentRequirements,
    what_to_create: contentRequirements,
    needed_at: {
      source: input.source,
      path: sourcePath,
      call_id: input.callId,
    },
    suggestion_context: suggestionContext,
    asset_name: input.title,
    industry: input.industry,
    lead_count: leads.length || 1,
    leads,
    source_artifact_id: input.sourceArtifactId,
    kb_asset_ids: (input.kbMatches ?? []).map((m) => m.id),
    explicit_evidence: leads.flatMap((lead) => [
      ...(lead.relevantProjects ?? []).map((project) => ({
        source_type: project.source ?? "project_database",
        source_id: project.id,
        asset_id: project.assetId,
        title: project.title,
        summary: project.summary,
        details: project.details,
        relevance_score: project.relevanceScore,
      })),
      ...(lead.relevantDocuments ?? []).map((doc) => ({
        source_type: "knowledge_base",
        source_id: doc.assetId,
        asset_id: doc.assetId,
        title: doc.title,
        summary: doc.snippet ?? doc.previewText,
        file_name: doc.fileName,
        format: doc.format,
        relevance_score: doc.relevanceScore,
      })),
    ]),
  };

  if (suggestionPlan) {
    brief.suggestion_plan = suggestionPlan;
    if (suggestionPlan.slide_plan?.length) {
      brief.slide_count = suggestionPlan.slide_plan.length;
    }
  }

  const createRes = await fetch("/api/content/studio/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      artifactType,
      brief,
      callId: input.callId,
      gapId: input.gapId,
      templateId: suggestionPlan?.template?.template_id || undefined,
      recommendedTemplateIds: (suggestionPlan?.recommended_templates ?? []).map((t) => t.template_id),
    }),
  });
  if (!createRes.ok) {
    throw new Error(await createRes.text());
  }
  const project = (await createRes.json()) as { id: string };
  return project.id;
}

/** Seed Studio from a pre-call deck preview with slide plan from pre-deck slides. */
export async function createProjectFromPreDeck(input: {
  callId: string;
  accountName: string;
  deckTitle: string;
  slides: Array<{
    id: string;
    title: string;
    narrative: string;
    sourceType?: string;
    assetId?: string | null;
  }>;
  industry?: string;
}): Promise<string> {
  const slidePlan = input.slides.map((slide, index) => ({
    slide: index + 1,
    heading: slide.title,
    body: slide.narrative,
    intent: slide.narrative.slice(0, 200),
    mode: slide.sourceType === "knowledge_base" && slide.assetId ? ("reuse" as const) : ("generate" as const),
    evidence_refs: slide.assetId ? [`kb:${slide.assetId}`] : [`session:${input.callId}`],
    data_points: [slide.narrative.slice(0, 120)],
    ...(slide.sourceType === "knowledge_base" && slide.assetId
      ? {
          reuse: {
            source_asset_id: slide.assetId,
            source_slide_index: Math.min(index + 1, 3),
            rationale: "Imported from pre-call deck KB match",
          },
        }
      : {}),
  }));

  const suggestionPlan: import("@/types/content_studio").SuggestionPlan = {
    suggestion_id: `predeck:${input.callId}`,
    source: "pre-dc",
    generation_reason: "Continue pre-call deck in Content Studio",
    needed_for: `Full deck for ${input.accountName}`,
    lead_count: 1,
    leads: [{ call_id: input.callId, account_name: input.accountName, industry: input.industry }],
    industry: input.industry,
    artifact_type: "deck",
    title: input.deckTitle,
    plan_summary: `Imported ${slidePlan.length} slides from the pre-call deck preview.`,
    slide_plan: slidePlan,
  };

  const brief: Record<string, unknown> = {
    artifact_type: "deck",
    account_name: input.accountName,
    call_id: input.callId,
    source: "pre-dc",
    generation_reason: suggestionPlan.generation_reason,
    needed_for: suggestionPlan.needed_for,
    asset_name: input.deckTitle,
    industry: input.industry,
    suggestion_plan: suggestionPlan,
    slide_count: slidePlan.length,
  };

  const createRes = await fetch("/api/content/studio/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.deckTitle,
      artifactType: "deck",
      brief,
      callId: input.callId,
    }),
  });
  if (!createRes.ok) {
    throw new Error(await createRes.text());
  }
  const project = (await createRes.json()) as { id: string };
  return project.id;
}
