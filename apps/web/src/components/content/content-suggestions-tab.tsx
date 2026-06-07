"use client";

import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { createProjectFromSuggestion } from "@/lib/content/create-project-from-suggestion";
import { groupPostDcGaps } from "@/lib/content/group-post-dc-gaps";
import {
  type ContentGenerationLead,
  type PreDcGenerationGroup,
  groupPreDcGaps,
} from "@/lib/content/group-pre-dc-gaps";
import { attachKbMatchesToGroups } from "@/lib/content/suggestion-context";
import { useDismissContentGap, useResolveContentGap } from "@/lib/data/content-gaps-hooks";
import { useContentPlan } from "@/lib/data/content-plan-hooks";
import {
  postDcContentGapKey,
  preDcContentGapKey,
  useContentGaps,
  useKbAssets,
  usePostDcContentGenerationGaps,
  usePreDcContentGenerationGaps,
} from "@/lib/data/hooks";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  FilePlus2,
  FileText,
  Lightbulb,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

const statusConfig = {
  draft: { variant: "warning" as const, label: "Draft ready" },
  "pending-review": { variant: "secondary" as const, label: "Pending review" },
  approved: { variant: "success" as const, label: "Approved" },
};

type ContentSuggestionSource = "pre-dc" | "post-dc";

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

  const audience =
    group.industryLabel || primaryLead?.industry || primaryLead?.accountName || "this call";
  const purpose = (group.neededFor || group.reason || "support the upcoming conversation")
    .replace(/\s+/g, " ")
    .trim();
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
      <ContentAgentInputsSection preDcGroups={preDcGroups} postDcGroups={postDcGroups} />

      {trackedGaps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="type-section-title text-foreground">Tracked suggestions</h2>
              <p className="type-caption text-muted-foreground">
                Gaps persisted in the content workflow with linked drafts.
              </p>
            </div>
            <Badge variant="outline">
              {trackedGaps.length} item{trackedGaps.length === 1 ? "" : "s"}
            </Badge>
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
                    <Link
                      href={
                        gap.studioProjectId
                          ? `/content/studio/${gap.studioProjectId}`
                          : `/content/${gap.id}`
                      }
                    >
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
  const assetCount = preDcAssetCount + postDcAssetCount;
  const suggestionItems = [
    ...preDcGroups.map((group) => ({ group, source: "pre-dc" as const })),
    ...postDcGroups.map((group) => ({ group, source: "post-dc" as const })),
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-section-title text-foreground">AI suggestions</h2>
          <p className="type-caption text-muted-foreground">
            Missing assets detected across call prep and post-call workflows, grouped by required document.
          </p>
        </div>
        {assetCount > 0 ? <Badge variant="warning">{assetCount} to generate</Badge> : null}
      </div>

      <ContentGenerationGrid
        items={suggestionItems}
        emptyMessage="No content gaps detected yet."
      />
    </section>
  );
}

function ContentGenerationGrid({
  items,
  emptyMessage,
}: {
  items: { group: PreDcGenerationGroup; source: ContentSuggestionSource }[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center type-body text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ group, source }) => (
        <ContentGenerationCard key={`${source}:${group.id}`} group={group} source={source} />
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

function compactSentence(value: string | undefined, limit = 180) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}…`;
}

function ContentGenerationCard({
  group,
  source,
}: {
  group: PreDcGenerationGroup;
  source: ContentSuggestionSource;
}) {
  const router = useRouter();
  const detailsId = useId();
  const planId = useId();
  const [generating, setGenerating] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [planRequested, setPlanRequested] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const dismissGap = useDismissContentGap();
  const resolveGap = useResolveContentGap();
  const primaryLead = group.leads[0];
  const gapKey = buildGapKey(group, primaryLead, source);
  const sourceCount = group.leads.length;
  const sourceArtifactId =
    primaryLead?.sourceArtifactId ||
    (group.id.startsWith("artifact:") ? group.id.slice("artifact:".length) : undefined);
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
  } = useContentPlan(planRequested ? planInput : null);
  const sourceLabel = source === "post-dc" ? "Post-DC" : "Pre-DC";
  const sourceDetailLabel = source === "post-dc" ? "Post-DC follow-up" : "Pre-DC call brief";
  const compactNeed = compactSentence(group.neededFor || group.reason || contentRequirements, 145);
  const kbMatchCount = group.kbMatches?.length ?? 0;
  const visibleKbMatches = (group.kbMatches ?? []).slice(0, 3);
  const hiddenKbMatchCount = Math.max(0, kbMatchCount - visibleKbMatches.length);
  const hasDetails = Boolean(
    group.reason || contentRequirements || group.industryLabel || kbMatchCount > 0 || sourcePath
  );

  function handlePlanToggle() {
    setPlanRequested(true);
    setPlanOpen((value) => !value);
  }

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
    <article className="rounded-lg border border-border/70 bg-card text-card-foreground shadow-none">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-warning/10 text-warning">
            <FilePlus2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="min-w-0 break-words type-panel-title font-semibold text-foreground">
                {group.name}
              </h3>
              <Badge variant="outline" className="h-6 capitalize">
                {formatArtifactType(group.type)}
              </Badge>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="h-6 cursor-default font-normal">
                      <span className="font-medium tabular-nums text-destructive">
                        {sourceCount}
                      </span>
                      <span className="text-muted-foreground">
                        brief{sourceCount === 1 ? "" : "s"}
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    className="max-w-xs whitespace-pre-line type-label"
                  >
                    {formatLeadTooltip(group.leads)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {kbMatchCount > 0 ? (
                <Badge variant="secondary" className="h-6 font-normal">
                  {kbMatchCount} KB match{kbMatchCount === 1 ? "" : "es"}
                </Badge>
              ) : null}
              <Link
                href={sourcePath}
                className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 type-label font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {sourceLabel}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {compactNeed ? (
              <p className="type-body-sm leading-relaxed text-foreground">
                <span className="font-medium text-foreground">Use for: </span>
                {compactNeed}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {hasDetails ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground hover:text-foreground"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen((value) => !value)}
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")}
                aria-hidden
              />
              Details
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            aria-expanded={planOpen}
            aria-controls={planId}
            onClick={handlePlanToggle}
          >
            {planLoading && planOpen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {planOpen ? "Hide plan" : "Preview plan"}
          </Button>
          <Button size="sm" disabled={generating} onClick={() => void handleGenerate()}>
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                Generate
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

      {detailsOpen && (
        <div id={detailsId} className="border-t border-border/60 px-5 py-4">
          <div className="grid gap-3 type-body-sm text-foreground md:grid-cols-[minmax(0,1fr)_minmax(220px,auto)]">
            <div className="space-y-2">
              {contentRequirements ? (
                <p className="leading-relaxed">
                  <span className="font-medium text-foreground">Create: </span>
                  {compactSentence(contentRequirements, 260)}
                </p>
              ) : null}
              {group.reason && group.reason !== contentRequirements ? (
                <p className="leading-relaxed">
                  <span className="font-medium text-foreground">Reason: </span>
                  {compactSentence(group.reason, 220)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 md:text-right">
              {group.industryLabel ? (
                <p>
                  <span className="font-medium text-foreground">Vertical: </span>
                  {group.industryLabel}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-foreground">Needed at: </span>
                <Link
                  href={sourcePath}
                  className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  {sourceDetailLabel}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </p>
            </div>
          </div>

          {visibleKbMatches.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleKbMatches.map((match) => (
                <Button
                  key={match.id}
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 max-w-full px-2 type-label"
                >
                  <Link href={`/content?tab=library&asset=${encodeURIComponent(match.id)}`}>
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{match.title}</span>
                  </Link>
                </Button>
              ))}
              {hiddenKbMatchCount > 0 ? (
                <Badge variant="secondary" className="h-7 font-normal">
                  +{hiddenKbMatchCount} more
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div id={planId}>
        {planOpen && planLoading && (
          <p className="mx-4 mb-3 rounded-md border border-dashed border-border px-3 py-2 type-caption text-muted-foreground">
            Building AI slide plan…
          </p>
        )}
        {planOpen && planError && (
          <p className="mx-4 mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 type-label text-destructive">
            Could not load the slide plan preview.
          </p>
        )}
        {planOpen && !planLoading && !planError && planPreview?.suggestion_plan && (
          <div className="px-4 pb-3">
            <SuggestionPlanPreview plan={planPreview.suggestion_plan} />
          </div>
        )}
        {planOpen && !planLoading && !planError && !planPreview?.suggestion_plan && (
          <p className="mx-4 mb-3 rounded-md border border-dashed border-border px-3 py-2 type-caption text-muted-foreground">
            No slide plan came back for this suggestion yet.
          </p>
        )}
      </div>
    </article>
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
  const visibleSlides = slides.slice(0, 6);
  const hiddenSlideCount = Math.max(0, slides.length - visibleSlides.length);
  const reuseCount = slides.filter((slide) => slide.mode === "reuse").length;
  const sourceCount = projects.length + kbAssets.length;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="type-label text-foreground">AI slide plan</p>
        <Badge variant="secondary" className="h-5 type-caption font-normal">
          {slides.length || "No"} slide{slides.length === 1 ? "" : "s"}
        </Badge>
        {reuseCount > 0 ? (
          <Badge variant="outline" className="h-5 type-caption font-normal">
            {reuseCount} reuse
          </Badge>
        ) : null}
        {sourceCount > 0 ? (
          <span className="type-caption text-muted-foreground">
            {sourceCount} source{sourceCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {slides.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 type-caption text-muted-foreground">
          No slide rows were returned for this plan.
        </p>
      )}
      {slides.length > 0 && (
        <div className="space-y-1.5">
          <ol className="space-y-1 type-caption text-muted-foreground">
            {visibleSlides.map((slide) => (
              <li
                key={slide.slide}
                className="grid gap-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="font-medium tabular-nums text-muted-foreground">
                  {slide.slide}.
                </span>
                <span className="font-medium text-foreground">{slide.heading}</span>
                <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  {slide.mode === "reuse" && (
                    <Badge variant="outline" className="h-5 type-caption">
                      Reuse
                    </Badge>
                  )}
                  {slide.mode === "hybrid" && (
                    <Badge variant="outline" className="h-5 type-caption">
                      Hybrid
                    </Badge>
                  )}
                  {slide.reuse && (
                    <span className="type-caption text-muted-foreground">
                      {slide.reuse.source_vertical || "KB"} slide {slide.reuse.source_slide_index}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {hiddenSlideCount > 0 ? (
            <p className="type-caption text-muted-foreground">
              +{hiddenSlideCount} more slide{hiddenSlideCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
