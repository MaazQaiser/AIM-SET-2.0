"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Database,
  FolderKanban,
  LayoutGrid,
  List,
  Loader2,
  Search,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { FilterChip } from "@dc-copilot/ui/components/chip";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { SearchInput } from "@dc-copilot/ui/components/search-input";
import { PageShell } from "@/components/layout/page-shell";
import { useKbProjects } from "@/lib/data/hooks";
import { cn } from "@/lib/cn";
import type { KBProject } from "@/types";
import {
  compactText,
  formatProjectDate,
  primarySolution,
  projectSearchText,
  uniqueProjectValues,
} from "./project-repo-utils";

type ProjectRepoView = "cards" | "table";

function ProjectRepoViewToggle({
  view,
  onChange,
}: {
  view: ProjectRepoView;
  onChange: (view: ProjectRepoView) => void;
}) {
  return (
    <fieldset
      className="inline-flex shrink-0 rounded-lg border border-border bg-muted/30 p-0.5"
      aria-label="Project repo layout"
    >
      <Button
        type="button"
        variant={view === "cards" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        onClick={() => onChange("cards")}
        aria-pressed={view === "cards"}
        aria-label="Cards"
        title="Cards"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Cards</span>
      </Button>
      <Button
        type="button"
        variant={view === "table" ? "secondary" : "ghost"}
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        onClick={() => onChange("table")}
        aria-pressed={view === "table"}
        aria-label="Table"
        title="Table"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">Table</span>
      </Button>
    </fieldset>
  );
}

function ProjectRepoStats({ projects }: { projects: KBProject[] }) {
  const industryCount = new Set(projects.map((project) => project.industry).filter(Boolean)).size;
  const sourceCount = new Set(projects.flatMap((project) => project.sourceAssetIds ?? [project.sourceAssetId])).size;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: "Projects", value: projects.length.toLocaleString() },
        { label: "Industries", value: industryCount.toLocaleString() },
        { label: "KB sources", value: sourceCount.toLocaleString() },
      ].map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function ProjectRepoTable({ projects }: { projects: KBProject[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-3">Project</th>
              <th scope="col" className="px-4 py-3">Company</th>
              <th scope="col" className="px-4 py-3">Industry</th>
              <th scope="col" className="px-4 py-3">Domain</th>
              <th scope="col" className="px-4 py-3">KB source</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projects.map((project) => (
              <tr key={project.id} className="align-top transition-colors hover:bg-muted/25">
                <td className="max-w-[320px] px-4 py-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <BriefcaseBusiness className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/knowledge/projects/${project.id}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {project.title}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {compactText(primarySolution(project), 180)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {project.companyName || "Not listed"}
                </td>
                <td className="px-4 py-3">
                  {project.industry ? (
                    <Badge variant="outline">{project.industry}</Badge>
                  ) : (
                    <span className="text-muted-foreground">Not listed</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-[220px] flex-wrap gap-1.5">
                    {project.domain ? (
                      <Badge variant="outline">{project.domain}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not listed</span>
                    )}
                    {project.subDomain && <Badge variant="outline">{project.subDomain}</Badge>}
                  </div>
                </td>
                <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{project.sourceAssetTitle}</span>
                  </div>
                  {project.sourceUploadedAt && (
                    <p className="mt-1 text-xs">Indexed {formatProjectDate(project.sourceUploadedAt)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="icon-sm" variant="secondary" aria-label={`Open ${project.title}`}>
                      <Link href={`/knowledge/projects/${project.id}`}>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="icon-sm" variant="outline" aria-label={`Open source for ${project.title}`}>
                      <Link href={`/knowledge/${project.sourceAssetId}`}>
                        <Database className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: KBProject }) {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{project.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {project.companyName || "Company not listed"}
              </p>
            </div>
          </div>
          {project.industry && (
            <Badge variant="outline" className="shrink-0">
              {project.industry}
            </Badge>
          )}
        </div>

        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {compactText(primarySolution(project), 320)}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {project.domain && <Badge variant="outline">{project.domain}</Badge>}
          {project.subDomain && <Badge variant="outline">{project.subDomain}</Badge>}
          {project.companyStage && <Badge variant="outline">{project.companyStage}</Badge>}
          {project.sourceCount > 1 && <Badge variant="secondary">{project.sourceCount} sources</Badge>}
        </div>

        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            <span className="truncate">{project.sourceAssetTitle}</span>
          </div>
          {project.sourceUploadedAt && (
            <p className="mt-1">Indexed {formatProjectDate(project.sourceUploadedAt)}</p>
          )}
        </div>

        <div className="mt-auto flex gap-2 border-t border-border/60 pt-3">
          <Button asChild size="sm" variant="secondary" className="h-8 flex-1 text-xs">
            <Link href={`/knowledge/projects/${project.id}`}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              Details
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 flex-1 text-xs">
            <Link href={`/knowledge/${project.sourceAssetId}`}>
              <Database className="h-3.5 w-3.5" />
              Source
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectRepoList({ embedded = false }: { embedded?: boolean }) {
  const { data: projects = [], isLoading } = useKbProjects();
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [domainFilter, setDomainFilter] = useState("All");
  const [view, setView] = useState<ProjectRepoView>("cards");

  const industryFilters = useMemo(() => ["All", ...uniqueProjectValues(projects, "industry", 7)], [projects]);
  const domainFilters = useMemo(() => ["All", ...uniqueProjectValues(projects, "domain", 7)], [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesSearch = !q || projectSearchText(project).includes(q);
      const matchesIndustry = industryFilter === "All" || project.industry === industryFilter;
      const matchesDomain = domainFilter === "All" || project.domain === domainFilter;
      return matchesSearch && matchesIndustry && matchesDomain;
    });
  }, [domainFilter, industryFilter, projects, search]);

  const content = (
    <div className={cn("space-y-5", embedded && "mt-1")}>
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Project repo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Projects parsed from project data stored in the knowledge base.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/knowledge">
              <Database className="h-4 w-4" />
              Knowledge base
            </Link>
          </Button>
        </div>
      )}

      <ProjectRepoStats projects={projects} />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            placeholder="Search KB projects..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            wrapperClassName="w-full lg:max-w-md"
            aria-label="Search KB projects"
          />
          <div className="flex flex-wrap items-center gap-2">
            <ProjectRepoViewToggle view={view} onChange={setView} />
            {embedded && (
              <Button asChild variant="outline" size="sm">
                <Link href="/knowledge/projects">
                  <ArrowUpRight className="h-4 w-4" />
                  Open repo
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {industryFilters.map((filter) => (
            <FilterChip
              key={filter}
              active={filter === industryFilter}
              onClick={() => setIndustryFilter(filter)}
            >
              {filter}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {domainFilters.map((filter) => (
            <FilterChip
              key={filter}
              active={filter === domainFilter}
              onClick={() => setDomainFilter(filter)}
            >
              {filter}
            </FilterChip>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading KB projects...
        </div>
      ) : filtered.length > 0 ? (
        view === "table" ? (
          <ProjectRepoTable projects={filtered} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={projects.length > 0 ? Search : FolderKanban}
          title={projects.length > 0 ? "No projects found" : "No KB projects found"}
          description={
            projects.length > 0
              ? "Adjust the search or filters to find another indexed project."
              : "Upload or ingest a project CSV in Knowledge Base to populate this repository."
          }
        />
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <PageShell size="wide">
      {content}
    </PageShell>
  );
}
