"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  FilePlus2,
  FileText,
  Lightbulb,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { AiGradientText } from "@/components/ai-gradient-text";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import {
  useContentGaps,
  useKbAssets,
  usePostDcContentGenerationGaps,
  usePreDcContentGenerationGaps,
  postDcContentGapKey,
  preDcContentGapKey,
} from "@/lib/data/hooks";
import {
  groupPreDcGaps,
  type ContentGenerationLead,
  type PreDcGenerationGroup,
} from "@/lib/content/group-pre-dc-gaps";
import { groupPostDcGaps } from "@/lib/content/group-post-dc-gaps";
import { attachKbMatchesToGroups } from "@/lib/content/suggestion-context";
import { createProjectFromSuggestion } from "@/lib/content/create-project-from-suggestion";
import { useContentPlan } from "@/lib/data/content-plan-hooks";
import { useDismissContentGap, useResolveContentGap } from "@/lib/data/content-gaps-hooks";
import { useRouter } from "next/navigation";
import Link from "next/link";

const statusConfig = {
  draft: { variant: "warning" as const, label: "Draft ready" },
  "pending-review": { variant: "secondary" as const, label: "Pending review" },
  approved: { variant: "success" as const, label: "Approved" },
};

type ContentInputTab = "pre-dc" | "post-dc";

function formatArtifactType(value: string) {
  return value.replace(/_/g, " ");
}

function titleCaseArtifactType(value: string) {
  return formatArtifactType(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isGenericUploadInstruction(value: string | undefined) {
  return /^upload\s+or\s+tag\s+kb\s+content\s+for:/i.test((value ?? "").trim());
}

function buildContentRequirements(
  group: PreDcGenerationGroup,
  primaryLead: ContentGenerationLead | undefined
) {
  const explicit = primaryLead?.contentRequirements?.trim();
  if (explicit && !isGenericUploadInstruction(explicit)) return explicit;

  const audience = group.industryLabel || primaryLead?.industry || primaryLead?.accountName || "this call";
  const purpose = (group.neededFor || group.reason || "support the upcoming conversation").replace(/\s+/g, " ").trim();
  const artifactType = titleCaseArtifactType(group.type).toLowerCase();
  return `Create a ${artifactType} titled "${group.name}" for ${audience}. It should cover: ${purpose} Include reusable proof points, relevant KB/project evidence, and a clear call next step.`;
}

function buildGapKey(
  group: { id: string; name: string },
  lead: { callId: string; sourceArtifactId?: string; sourceItemId?: string } | undefined,
  source: "pre-dc" | "post-dc"
) {
  if (!lead) return group.id;
  if (source === "post-dc") {
    return `post_dc:${lead.callId}:${group.name.trim().toLowerCase()}`;
  }
  const artifactPart =
    lead.sourceArtifactId?.trim() ||
    lead.sourceItemId?.trim() ||
    (group.id.startsWith("artifact:") ? group.id.slice("artifact:".length) : group.name);
  return `pre_dc:${lead.callId}:${artifactPart}`;
}

export function ContentSuggestionsTab() {
  const { data: gaps = [] } = useContentGaps();
  const { data: kbAssets = [] } = useKbAssets();
  const { data: preDcGaps = [] } = usePreDcContentGenerationGaps();
  const { data: postDcGaps = [] } = usePostDcContentGenerationGaps();
  const hiddenAgentGapKeys = useMemo(
    () =>
      new Set(
        gaps
          .filter((gap) => gap.workflowStatus && gap.workflowStatus !== "open")
          .map((gap) => gap.gapKey)
          .filter((key): key is string => typeof key === "string" && key.length > 0)
      ),
    [gaps]
  );
  const visiblePreDcGaps = useMemo(
    () => preDcGaps.filter((gap) => !hiddenAgentGapKeys.has(preDcContentGapKey(gap))),
    [hiddenAgentGapKeys, preDcGaps]
  );
  const visiblePostDcGaps = useMemo(
    () => postDcGaps.filter((gap) => !hiddenAgentGapKeys.has(postDcContentGapKey(gap))),
    [hiddenAgentGapKeys, postDcGaps]
  );
  const preDcGroups = useMemo(
    () => attachKbMatchesToGroups(groupPreDcGaps(visiblePreDcGaps), kbAssets),
    [visiblePreDcGaps, kbAssets]
  );
  const postDcGroups = useMemo(
    () => attachKbMatchesToGroups(groupPostDcGaps(visiblePostDcGaps), kbAssets),
    [visiblePostDcGaps, kbAssets]
  );
  const trackedGaps = useMemo(
    () => gaps.filter((gap) => gap.workflowStatus === "in_progress"),
    [gaps]
  );
  const hasAgentInputs = preDcGroups.length > 0 || postDcGroups.length > 0;
  const hasAnyGaps = hasAgentInputs || trackedGaps.length > 0;

  if (!hasAnyGaps) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No content suggestions"
        description="Missing Pre-DC and Post-DC assets will appear here when the workflow detects gaps."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ContentAgentInputsSection
        preDcGroups={preDcGroups}
        postDcGroups={postDcGroups}
      />

      {trackedGaps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="type-section-title text-foreground">Tracked suggestions</h2>
              <p className="type-caption text-muted-foreground">
                Gaps persisted in the content workflow with linked drafts.
              </p>
            </div>
            <Badge variant="outline">{trackedGaps.length} item{trackedGaps.length === 1 ? "" : "s"}</Badge>
          </div>
          {trackedGaps.map((gap) => {
            const config = statusConfig[gap.status];
            return (
              <Card key={gap.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <CardTitle>{gap.topic}</CardTitle>
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <span className="flex items-center gap-1 type-caption text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    Detected from: {gap.sourcedFrom}
                  </span>
                  {gap.sourcePath && (
                    <Button asChild variant="ghost" size="sm" className="h-7 w-fit px-2">
                      <Link href={gap.sourcePath}>
                        Needed at
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                  {(gap.reason || gap.neededFor) && (
                    <p className="type-caption text-muted-foreground">
                      {[gap.reason, gap.neededFor].filter(Boolean).join(" ")}
                    </p>
                  )}
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="type-label capitalize">AI draft {gap.draftType}</span>
                      <AIGeneratedBadge />
                    </div>
                    <p className="type-caption text-muted-foreground">
                      Review evidence chain and route priority back to the content agent.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={gap.studioProjectId ? `/content/studio/${gap.studioProjectId}` : `/content/${gap.id}`}>
                      Open in studio
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContentAgentInputsSection({
  preDcGroups,
  postDcGroups,
}: {
  preDcGroups: PreDcGenerationGroup[];
  postDcGroups: PreDcGenerationGroup[];
}) {
  const preDcAssetCount = preDcGroups.length;
  const postDcAssetCount = postDcGroups.length;
  const defaultTab: ContentInputTab = preDcAssetCount > 0 ? "pre-dc" : "post-dc";
  const [activeTab, setActiveTab] = useState<ContentInputTab>(defaultTab);

  const activeGroups = activeTab === "pre-dc" ? preDcGroups : postDcGroups;
  const activeAssetCount = activeTab === "pre-dc" ? preDcAssetCount : postDcAssetCount;
  const description =
    activeTab === "pre-dc"
      ? "Missing assets detected during call prep, grouped by required document."
      : "Missing assets flagged after call wrap-up, grouped by required document.";

  return (
    <section className="space-y-3">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ContentInputTab)}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="type-section-title text-foreground">AI suggestions</h2>
            <p className="type-caption text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TabsList className="h-9 rounded-lg bg-muted/50 p-1">
              <TabsTrigger value="pre-dc" className="px-3">
                Pre-DC
                {preDcAssetCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 type-caption font-medium tabular-nums">
                    {preDcAssetCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="post-dc" className="type-label px-3">
                Post-DC
                {postDcAssetCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 type-caption font-medium tabular-nums">
                    {postDcAssetCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            {activeAssetCount > 0 && (
              <Badge variant="warning">
                {activeAssetCount} to generate
              </Badge>
            )}
          </div>
        </div>

        <TabsContent value="pre-dc" className="m-0 focus-visible:outline-none">
          <ContentGenerationGrid
            groups={preDcGroups}
            source="pre-dc"
            emptyMessage="No Pre-DC content gaps detected yet."
          />
        </TabsContent>
        <TabsContent value="post-dc" className="m-0 focus-visible:outline-none">
          <ContentGenerationGrid
            groups={postDcGroups}
            source="post-dc"
            emptyMessage="No Post-DC content gaps detected yet. Run call wrap-up to flag missing assets."
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function ContentGenerationGrid({
  groups,
  source,
  emptyMessage,
}: {
  groups: PreDcGenerationGroup[];
  source: "pre-dc" | "post-dc";
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center type-body text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <ContentGenerationCard key={group.id} group={group} source={source} />
      ))}
    </div>
  );
}

function formatLeadTooltip(leads: ContentGenerationLead[]) {
  return leads
    .map((lead) => {
      const name = lead.leadName?.trim() || "Lead not assigned";
      return lead.accountName ? `${name} · ${lead.accountName}` : name;
    })
    .join("\n");
}

function ContentGenerationCard({
  group,
  source,
}: {
  group: PreDcGenerationGroup;
  source: "pre-dc" | "post-dc";
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const dismissGap = useDismissContentGap();
  const resolveGap = useResolveContentGap();
  const primaryLead = group.leads[0];
  const gapKey = buildGapKey(group, primaryLead, source);
  const sourceCount = group.leads.length;
  const sourceArtifactId =
    primaryLead?.sourceArtifactId || (group.id.startsWith("artifact:") ? group.id.slice("artifact:".length) : undefined);
  const sourcePath =
    primaryLead?.sourcePath ||
    (primaryLead?.callId
      ? source === "post-dc"
        ? `/calls/${primaryLead.callId}/post-dc`
        : `/calls/${primaryLead.callId}`
      : "/content?tab=suggestions");
  const contentRequirements = buildContentRequirements(group, primaryLead);
  const suggestionContext = {
    ...(primaryLead?.context ?? {}),
    source: source === "post-dc" ? "post_dc" : "pre_dc",
    sourcePath,
    gapKey,
    assetName: group.name,
    artifactType: group.type,
    reason: group.reason,
    neededFor: group.neededFor,
    contentRequirements,
    whatToCreate: contentRequirements,
    leads: group.leads,
    kbMatches: group.kbMatches ?? [],
  };

  const planInput = {
    suggestionId: group.id,
    title: group.name,
    artifactType: group.type,
    source,
    generationReason: group.reason,
    neededFor: group.neededFor,
    sourcePath,
    contentRequirements,
    context: suggestionContext,
    industry: group.industryLabel,
    leads: group.leads.map((lead) => ({
      callId: lead.callId,
      accountName: lead.accountName,
      leadName: lead.leadName,
      industry: lead.industry ?? group.industryLabel,
      relevantProjects: lead.relevantProjects,
      relevantDocuments: lead.relevantDocuments,
      recommendedDeck: lead.recommendedDeck,
    })),
    kbAssetIds: (group.kbMatches ?? []).map((m) => m.id),
  };
  const {
    data: planPreview,
    isLoading: planLoading,
    isError: planError,
  } = useContentPlan(expanded ? planInput : null);

  async function handleDismiss() {
    try {
      await dismissGap.mutateAsync({
        gapKey,
        source,
        name: group.name,
        artifactType: group.type,
        callId: primaryLead?.callId,
        reason: group.reason,
        neededFor: group.neededFor,
        sourcePath,
        contentRequirements,
        context: suggestionContext,
        priority: group.priority,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to dismiss suggestion");
    }
  }

  async function handleUploadResolved(asset: { id: string }) {
    try {
      await resolveGap.mutateAsync({
        gapKey,
        kbAssetId: asset.id,
        source,
        name: group.name,
        artifactType: group.type,
        callId: primaryLead?.callId,
        reason: group.reason,
        neededFor: group.neededFor,
        sourcePath,
        contentRequirements,
        context: suggestionContext,
        priority: group.priority,
      });
    } catch {
      // Gap may not exist in backend yet; upload still succeeded.
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const projectId = await createProjectFromSuggestion({
        title: group.name,
        artifactType: group.type,
        suggestionId: group.id,
        callId: primaryLead?.callId,
        gapId: gapKey,
        accountName: primaryLead?.accountName,
        leadName: primaryLead?.leadName,
        reason: group.reason,
        neededFor: group.neededFor,
        sourcePath,
        contentRequirements,
        context: suggestionContext,
        industry: group.industryLabel,
        source,
        leads: group.leads,
        kbMatches: group.kbMatches,
        sourceArtifactId,
      });
      router.push(`/content/studio/${projectId}?suggestionId=${encodeURIComponent(group.id)}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to create content");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2">
            <FilePlus2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 space-y-2">
              <CardTitle className="break-words type-body font-medium">{group.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {formatArtifactType(group.type)}
                </Badge>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-default font-normal">
                        <span className="font-medium tabular-nums text-destructive">
                          {sourceCount} call brief{sourceCount === 1 ? "" : "s"}
                        </span>
                        <span className="text-muted-foreground">need this asset</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-line type-label">
                      {formatLeadTooltip(group.leads)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" disabled={generating} onClick={() => void handleGenerate()}>
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Generate in Studio
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
            <KbUploadButton
              defaultTitle={group.name}
              onAssetReady={(asset) => void handleUploadResolved(asset)}
              trigger={
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Upload instead">
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    disabled={dismissGap.isPending}
                    aria-label="Dismiss suggestion"
                    onClick={() => void handleDismiss()}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Dismiss</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <AiGradientText className="type-label">Why generate it</AiGradientText>
          </div>
          <p className="type-label leading-relaxed text-muted-foreground">{group.reason}</p>
          {group.kbMatches && group.kbMatches.length > 0 && (
            <SuggestionKbMatches matches={group.kbMatches} />
          )}
        </div>

        <p className="type-caption text-muted-foreground">
          <span className="font-medium text-foreground">Needed for: </span>
          {group.neededFor}
        </p>
        <div className="flex flex-wrap items-center gap-2 type-caption text-muted-foreground">
          <span className="font-medium text-foreground">Needed at:</span>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 type-label">
            <Link href={sourcePath}>
              {source === "post-dc" ? "Post-DC follow-up" : "Pre-DC call brief"}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
        {contentRequirements && contentRequirements !== group.reason && (
          <p className="type-caption text-muted-foreground">
            <span className="font-medium text-foreground">What to create: </span>
            {contentRequirements}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 type-caption text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide plan preview" : "Preview AI slide plan"}
        </Button>

        {expanded && planLoading && (
          <p className="rounded-md border border-dashed border-border px-3 py-2 type-caption text-muted-foreground">
            Building AI slide plan…
          </p>
        )}
        {expanded && planError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 type-label text-destructive">
            Could not load the slide plan preview.
          </p>
        )}
        {expanded && !planLoading && !planError && planPreview?.suggestion_plan && (
          <SuggestionPlanPreview plan={planPreview.suggestion_plan} />
        )}
        {expanded && !planLoading && !planError && !planPreview?.suggestion_plan && (
          <p className="rounded-md border border-dashed border-border px-3 py-2 type-caption text-muted-foreground">
            No slide plan came back for this suggestion yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionKbMatches({
  matches,
}: {
  matches: NonNullable<PreDcGenerationGroup["kbMatches"]>;
}) {
  return (
    <div className="space-y-1.5">
      <p className="type-label text-foreground">Related in KB</p>
      <div className="flex flex-wrap gap-1.5">
        {matches.map((match) => (
          <Button key={match.id} asChild size="sm" variant="outline" className="h-7 max-w-full px-2 type-label">
            <Link href={`/content?tab=library&asset=${encodeURIComponent(match.id)}`}>
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{match.title}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function SuggestionPlanPreview({
  plan,
}: {
  plan: import("@/types/content_studio").SuggestionPlan;
}) {
  const projects = plan.evidence?.projects ?? [];
  const kbAssets = plan.evidence?.kb_assets ?? [];
  const slides = plan.slide_plan ?? [];

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      {plan.plan_summary && (
        <p className="type-label leading-relaxed text-muted-foreground">{plan.plan_summary}</p>
      )}
      {projects.length > 0 && (
        <div className="space-y-1">
          <p className="type-label text-foreground">Matching projects</p>
          <div className="flex flex-wrap gap-1.5">
            {projects.map((proj) => (
              <Badge key={proj.asset_id} variant="secondary" className="type-caption font-normal">
                {proj.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {kbAssets.length > 0 && (
        <div className="space-y-1">
          <p className="type-label text-foreground">Reusable KB assets</p>
          <div className="flex flex-wrap gap-1.5">
            {kbAssets.map((asset) => (
              <Badge key={asset.asset_id} variant="outline" className="type-caption font-normal">
                {asset.title}
                {asset.slide_count ? ` · ${asset.slide_count} slides` : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {plan.template?.name && (
        <p className="type-caption text-muted-foreground">
          <span className="font-medium text-foreground">Default template: </span>
          {plan.template.name}
        </p>
      )}
      {slides.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 type-caption text-muted-foreground">
          No slide rows were returned for this plan.
        </p>
      )}
      {slides.length > 0 && (
        <div className="space-y-1.5">
          <p className="type-label text-foreground">Proposed slides</p>
          <ol className="space-y-1 type-caption text-muted-foreground">
            {slides.map((slide) => (
              <li key={slide.slide} className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-foreground">{slide.slide}. {slide.heading}</span>
                {slide.mode === "reuse" && (
                  <Badge variant="outline" className="h-5 type-caption">Reuse</Badge>
                )}
                {slide.mode === "hybrid" && (
                  <Badge variant="outline" className="h-5 type-caption">Hybrid</Badge>
                )}
                {slide.reuse && (
                  <span className="type-caption text-muted-foreground">
                    from {slide.reuse.source_vertical || "KB"} slide {slide.reuse.source_slide_index}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
