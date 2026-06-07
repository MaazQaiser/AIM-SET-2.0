"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  Database,
  FileText,
  FolderKanban,
  Globe2,
  Layers,
  Loader2,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { useKbProject } from "@/lib/data/hooks";
import type { KBProject } from "@/types";
import {
  formatProjectDate,
  projectFieldEntries,
} from "./project-repo-utils";

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TextSection({
  title,
  value,
}: {
  title: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function FieldTable({ project }: { project: KBProject }) {
  const entries = projectFieldEntries(project, 28);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Indexed fields</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <dl className="divide-y divide-border/60">
            {entries.map((entry) => (
              <div key={entry.key} className="grid gap-1 py-2 sm:grid-cols-[190px_1fr]">
                <dt className="text-xs font-medium text-muted-foreground">{entry.label}</dt>
                <dd className="min-w-0 whitespace-pre-wrap break-words text-sm text-foreground">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No structured fields were indexed for this project.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SourcePanel({ project }: { project: KBProject }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">KB source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-start gap-2">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-foreground">
                {project.sourceAssetTitle}
              </p>
              {project.sourceFileName && (
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {project.sourceFileName}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {project.sourceAssetType && <Badge variant="outline">{project.sourceAssetType}</Badge>}
          {project.sourceUploadedAt && (
            <Badge variant="outline">Indexed {formatProjectDate(project.sourceUploadedAt)}</Badge>
          )}
          {project.sourceCount > 1 && <Badge variant="secondary">{project.sourceCount} matched sources</Badge>}
        </div>

        <Button asChild variant="secondary" className="w-full justify-start">
          <Link href={`/knowledge/${project.sourceAssetId}`}>
            <ArrowUpRight className="h-4 w-4" />
            Open source asset
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProjectRepoDetailClient({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError } = useKbProject(projectId);

  if (isLoading) {
    return (
      <PageShell size="wide">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading KB project...
        </div>
      </PageShell>
    );
  }

  if (isError || !project) {
    return (
      <PageShell size="wide">
        <Link href="/content?tab=projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Projects
        </Link>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Project not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This project may not be present in the indexed KB project data.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell size="wide">
      <PageHeader className="space-y-3">
        <Link href="/content?tab=projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Projects
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {project.industry && <Badge variant="outline">{project.industry}</Badge>}
                {project.domain && <Badge variant="outline">{project.domain}</Badge>}
                {project.companyStage && <Badge variant="outline">{project.companyStage}</Badge>}
              </div>
              <h1 className="break-words text-2xl font-semibold text-foreground">{project.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {project.summary}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/content?tab=projects">
                <FolderKanban className="h-4 w-4" />
                Projects
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/knowledge/${project.sourceAssetId}`}>
                <Database className="h-4 w-4" />
                Source asset
              </Link>
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile icon={Building2} label="Company" value={project.companyName || "Not listed"} />
        <MetricTile icon={Globe2} label="Industry" value={project.industry || "Not listed"} />
        <MetricTile icon={Layers} label="Domain" value={project.domain || "Not listed"} />
        <MetricTile icon={CalendarDays} label="Timeline" value={project.endDate || project.startDate || "Not listed"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5 min-w-0">
          <TextSection title="Problem statement" value={project.problemStatement} />
          <TextSection title="Business outcome" value={project.businessOutcome} />
          <TextSection title="Functional solution" value={project.functionalSolution} />
          <TextSection title="Technical solution" value={project.technicalSolution} />
          <FieldTable project={project} />
        </div>

        <aside className="space-y-5">
          <SourcePanel project={project} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Project links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.definitionsUrl && (
                <Button asChild variant="secondary" className="w-full justify-start">
                  <a href={project.definitionsUrl} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4" />
                    Definitions
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/content?tab=library">
                  <Database className="h-4 w-4" />
                  Content Library
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
