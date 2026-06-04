"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  FilePlus2,
  FileText,
  Lightbulb,
  Users,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { PageShell } from "@/components/layout/page-shell";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import {
  useContentGaps,
  usePostDcContentGenerationGaps,
  usePreDcContentGenerationGaps,
} from "@/lib/data/hooks";
import {
  groupPreDcGaps,
  type ContentGenerationLead,
  type PreDcGenerationGroup,
} from "@/lib/content/group-pre-dc-gaps";
import { groupPostDcGaps } from "@/lib/content/group-post-dc-gaps";

const statusConfig = {
  draft: { variant: "warning" as const, label: "Draft ready" },
  "pending-review": { variant: "secondary" as const, label: "Pending review" },
  approved: { variant: "success" as const, label: "Approved" },
};

const preDcStatusConfig = {
  missing: { variant: "destructive" as const, label: "Missing" },
  partial: { variant: "warning" as const, label: "Partial" },
};

type ContentInputTab = "pre-dc" | "post-dc";

function formatArtifactType(value: string) {
  return value.replace(/_/g, " ");
}

export default function ContentPage() {
  const { data: gaps = [] } = useContentGaps();
  const { data: preDcGaps = [] } = usePreDcContentGenerationGaps();
  const { data: postDcGaps = [] } = usePostDcContentGenerationGaps();
  const preDcGroups = groupPreDcGaps(preDcGaps);
  const postDcGroups = groupPostDcGaps(postDcGaps);
  const hasAgentInputs = preDcGaps.length > 0 || postDcGaps.length > 0;
  const hasAnyGaps = hasAgentInputs || gaps.length > 0;

  return (
    <PageShell size="wide">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Content</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Content agent inputs from Pre-DC gaps and generated drafts
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/content/studio">Open Content Studio</Link>
        </Button>
      </div>

      <ContentAgentInputsSection
        preDcGroups={preDcGroups}
        preDcGapCount={preDcGaps.length}
        postDcGroups={postDcGroups}
        postDcGapCount={postDcGaps.length}
      />

      {gaps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Draft review queue</h2>
              <p className="text-xs text-muted-foreground">
                Content gaps already routed into draft or approval workflow.
              </p>
            </div>
            <Badge variant="outline">{gaps.length} item{gaps.length === 1 ? "" : "s"}</Badge>
          </div>
          {gaps.map((gap) => {
            const config = statusConfig[gap.status];
            return (
              <Card key={gap.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <CardTitle className="text-sm font-medium">{gap.topic}</CardTitle>
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    Detected from: {gap.sourcedFrom}
                  </span>
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium capitalize">AI draft {gap.draftType}</span>
                      <AIGeneratedBadge />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Review evidence chain and route priority back to the content agent.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/content/${gap.id}`}>Open in studio</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!hasAnyGaps && (
        <EmptyState
          icon={Lightbulb}
          title="No content gaps detected"
          description="Missing Pre-DC and Post-DC assets will appear here with the lead they belong to."
        />
      )}
    </PageShell>
  );
}

function ContentAgentInputsSection({
  preDcGroups,
  preDcGapCount,
  postDcGroups,
  postDcGapCount,
}: {
  preDcGroups: PreDcGenerationGroup[];
  preDcGapCount: number;
  postDcGroups: PreDcGenerationGroup[];
  postDcGapCount: number;
}) {
  const defaultTab: ContentInputTab = preDcGapCount > 0 ? "pre-dc" : "post-dc";
  const [activeTab, setActiveTab] = useState<ContentInputTab>(defaultTab);

  const activeGroups = activeTab === "pre-dc" ? preDcGroups : postDcGroups;
  const activeGapCount = activeTab === "pre-dc" ? preDcGapCount : postDcGapCount;
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
            <h2 className="text-sm font-semibold text-foreground">Content agent inputs</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TabsList className="h-9 rounded-lg bg-muted/50 p-1">
              <TabsTrigger value="pre-dc" className="text-xs px-3">
                Pre-DC
                {preDcGapCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                    {preDcGapCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="post-dc" className="text-xs px-3">
                Post-DC
                {postDcGapCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                    {postDcGapCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            {activeGroups.length > 0 && (
              <Badge variant="warning">
                {activeGroups.length} asset{activeGroups.length === 1 ? "" : "s"} across {activeGapCount}{" "}
                lead{activeGapCount === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>

        <TabsContent value="pre-dc" className="m-0 focus-visible:outline-none">
          <ContentGenerationGrid groups={preDcGroups} emptyMessage="No Pre-DC content gaps detected yet." />
        </TabsContent>
        <TabsContent value="post-dc" className="m-0 focus-visible:outline-none">
          <ContentGenerationGrid
            groups={postDcGroups}
            emptyMessage="No Post-DC content gaps detected yet. Run call wrap-up to flag missing assets."
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function ContentGenerationGrid({
  groups,
  emptyMessage,
}: {
  groups: PreDcGenerationGroup[];
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {groups.map((group) => (
        <ContentGenerationCard key={group.id} group={group} />
      ))}
    </div>
  );
}

function ContentGenerationCard({ group }: { group: PreDcGenerationGroup }) {
  const status = preDcStatusConfig[group.status];
  const visibleLeads = group.leads.slice(0, 4);
  const remainingLeadCount = Math.max(group.leads.length - visibleLeads.length, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex min-w-0 items-start gap-2">
          <FilePlus2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <CardTitle className="break-words text-sm font-medium">{group.name}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {formatArtifactType(group.type)}
              </Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
              <Badge variant="outline">P{group.priority}</Badge>
              <Badge variant="outline">
                <Users className="h-3 w-3" />
                Needed by {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Why generate it: </span>
            {group.reason}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Needed for: </span>
            {group.neededFor}
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <p className="font-medium text-foreground">Leads needing this asset</p>
          <div className="flex flex-wrap items-center gap-2">
            {visibleLeads.map((lead) => (
              <LeadNeedRow key={lead.id} item={lead} />
            ))}
          </div>
          {remainingLeadCount > 0 && (
            <p className="text-muted-foreground">
              +{remainingLeadCount} more lead{remainingLeadCount === 1 ? "" : "s"} need this same document.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={group.studioHref}>
              Generate in Studio
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadNeedRow({ item }: { item: ContentGenerationLead }) {
  return (
    <Link href={`/calls/${item.callId}`} className="inline-flex">
      <Badge
        variant="outline"
        className="gap-1.5 text-[10px] font-medium transition-colors hover:bg-muted/40"
      >
        <span>{item.leadName ?? "Lead not assigned"}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      </Badge>
    </Link>
  );
}
