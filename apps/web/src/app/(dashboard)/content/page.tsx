"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  FilePlus2,
  FileText,
  Lightbulb,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { useContentGaps, usePreDcContentGenerationGaps } from "@/lib/data/hooks";
import type { PreDcContentGenerationGap } from "@/lib/data/hooks";

const statusConfig = {
  draft: { variant: "warning" as const, label: "Draft ready" },
  "pending-review": { variant: "secondary" as const, label: "Pending review" },
  approved: { variant: "success" as const, label: "Approved" },
};

const preDcStatusConfig = {
  missing: { variant: "destructive" as const, label: "Missing" },
  partial: { variant: "warning" as const, label: "Partial" },
};

function formatArtifactType(value: string) {
  return value.replace(/_/g, " ");
}

function formatCallTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeDocumentKey(item: PreDcContentGenerationGap) {
  return `${item.type}:${item.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

interface PreDcGenerationGroup {
  id: string;
  name: string;
  type: PreDcContentGenerationGap["type"];
  priority: number;
  status: PreDcContentGenerationGap["status"];
  reason: string;
  neededFor: string;
  studioHref: string;
  leads: PreDcContentGenerationGap[];
}

function buildGroupStudioHref(group: Omit<PreDcGenerationGroup, "studioHref">) {
  const params = new URLSearchParams({
    template: group.type,
    source: "pre-dc",
    asset: group.name,
    leadCount: String(group.leads.length),
  });
  return `/content/studio?${params.toString()}`;
}

function groupPreDcGaps(items: PreDcContentGenerationGap[]): PreDcGenerationGroup[] {
  const byDocument = new Map<string, Omit<PreDcGenerationGroup, "studioHref">>();

  for (const item of items) {
    const key = normalizeDocumentKey(item);
    const existing = byDocument.get(key);
    if (!existing) {
      byDocument.set(key, {
        id: key,
        name: item.name,
        type: item.type,
        priority: item.priority,
        status: item.status,
        reason: item.reason,
        neededFor: item.neededFor,
        leads: [item],
      });
      continue;
    }

    existing.priority = Math.min(existing.priority, item.priority);
    existing.status = existing.status === "missing" || item.status === "missing" ? "missing" : "partial";
    existing.leads.push(item);
  }

  return [...byDocument.values()]
    .map((group) => ({
      ...group,
      studioHref: buildGroupStudioHref(group),
      leads: group.leads.sort((a, b) => {
        const accountCompare = a.accountName.localeCompare(b.accountName);
        if (accountCompare !== 0) return accountCompare;
        return (a.leadName ?? "").localeCompare(b.leadName ?? "");
      }),
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (b.leads.length !== a.leads.length) return b.leads.length - a.leads.length;
      return a.name.localeCompare(b.name);
    });
}

export default function ContentPage() {
  const { data: gaps = [] } = useContentGaps();
  const { data: preDcGaps = [] } = usePreDcContentGenerationGaps();
  const preDcGroups = groupPreDcGaps(preDcGaps);
  const hasAnyGaps = preDcGaps.length > 0 || gaps.length > 0;

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

      {preDcGroups.length > 0 && (
        <PreDcGenerationQueue gapCount={preDcGaps.length} groups={preDcGroups} />
      )}

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
          description="Missing Pre-DC assets will appear here with the lead they belong to."
        />
      )}
    </PageShell>
  );
}

function PreDcGenerationQueue({
  groups,
  gapCount,
}: {
  groups: PreDcGenerationGroup[];
  gapCount: number;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Pre-DC content agent inputs</h2>
          <p className="text-xs text-muted-foreground">
            Missing assets detected during call prep, grouped by required document.
          </p>
        </div>
        <Badge variant="warning">
          {groups.length} asset{groups.length === 1 ? "" : "s"} across {gapCount} lead
          {gapCount === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <PreDcGenerationCard key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}

function PreDcGenerationCard({ group }: { group: PreDcGenerationGroup }) {
  const status = preDcStatusConfig[group.status];
  const visibleLeads = group.leads.slice(0, 4);
  const remainingLeadCount = Math.max(group.leads.length - visibleLeads.length, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <p className="font-medium text-foreground">Leads needing this asset</p>
          <div className="space-y-2">
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

function LeadNeedRow({ item }: { item: PreDcContentGenerationGap }) {
  const callTime = formatCallTime(item.scheduledAt);

  return (
    <div className="grid gap-2 border-t border-border/60 pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
      <QueueMeta icon={User} label="Lead" value={item.leadName ?? "Lead not assigned"} />
      <QueueMeta icon={Building2} label="Account" value={item.accountName} />
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {item.leadTitle && <QueueMeta icon={FileText} label="Role" value={item.leadTitle} />}
        {callTime && <QueueMeta icon={CalendarClock} label="Call" value={callTime} />}
        <Button asChild size="sm" variant="outline" className="h-7 px-2">
          <Link href={`/calls/${item.callId}`}>Open</Link>
        </Button>
      </div>
    </div>
  );
}

function QueueMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium text-foreground">{value}</span>
    </div>
  );
}
