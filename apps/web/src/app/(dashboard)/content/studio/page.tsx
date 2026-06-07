"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import {
  useCreateStudioProject,
  useDeleteStudioProject,
  useStudioProjects,
} from "@/lib/data/content-studio-hooks";

const ARTIFACT_TYPES = [
  { value: "deck", label: "Deck" },
  { value: "one_pager", label: "One pager" },
  { value: "image", label: "Image" },
] as const;

export default function ContentStudioPage() {
  return (
    <Suspense fallback={<div className="p-6 type-body-sm text-muted-foreground">Loading studio...</div>}>
      <ContentStudioPageInner />
    </Suspense>
  );
}

function ContentStudioPageInner() {
  const searchParams = useSearchParams();
  const { data: projects = [], isLoading } = useStudioProjects();
  const create = useCreateStudioProject();
  const del = useDeleteStudioProject();
  const deepLinkStartedRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("New deck");
  const [artifactType, setArtifactType] = useState<(typeof ARTIFACT_TYPES)[number]["value"]>("deck");
  const [createError, setCreateError] = useState<string>("");
  const [deepLinkStatus, setDeepLinkStatus] = useState<string>("");

  useEffect(() => {
    const source = searchParams.get("source");
    const asset = searchParams.get("asset");
    const account = searchParams.get("account");
    const template = searchParams.get("template");
    const callId = searchParams.get("callId");
    if (!source && !asset && !account && !template && !callId) return;
    if (deepLinkStartedRef.current) return;

    const signature = searchParams.toString();
    const sessionKey = `content-studio:auto-create:${signature}`;
    const existingProjectId = window.sessionStorage.getItem(sessionKey);
    if (existingProjectId && existingProjectId !== "started") {
      window.location.href = `/content/studio/${existingProjectId}`;
      return;
    }
    if (existingProjectId === "started") return;
    deepLinkStartedRef.current = true;
    window.sessionStorage.setItem(sessionKey, "started");

    const resolvedType = artifactTypeFromDeepLink(template, asset);
    const resolvedTitle = projectTitleFromDeepLink({ asset, account, artifactType: resolvedType });
    const brief = buildBriefFromDeepLink({
      artifactType: resolvedType,
      template,
      source,
      asset,
      account,
      callId,
      lead: searchParams.get("lead"),
      leadCount: searchParams.get("leadCount"),
    });

    async function createFromDeepLink() {
      try {
        setDeepLinkStatus("Creating project from content gap...");
        const project = await create.mutateAsync({
          title: resolvedTitle,
          artifactType: resolvedType,
          brief,
        });
        const message = seedMessageFromDeepLink({
          title: resolvedTitle,
          artifactType: resolvedType,
          source,
          asset,
          account,
          leadCount: searchParams.get("leadCount"),
        });
        await fetch(`/api/content/studio/projects/${project.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, generate: false }),
        });
        window.sessionStorage.setItem(sessionKey, project.id);
        window.location.href = `/content/studio/${project.id}`;
      } catch (err) {
        window.sessionStorage.removeItem(sessionKey);
        setDeepLinkStatus(err instanceof Error ? err.message : "Failed to create project from link");
      }
    }

    void createFromDeepLink();
  }, [create, searchParams]);

  function openCreateDialog() {
    setCreateError("");
    setTitle("New deck");
    setArtifactType("deck");
    setDialogOpen(true);
  }

  async function handleNew() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setCreateError("Project title is required.");
      return;
    }
    try {
      const p = await create.mutateAsync({ title: trimmedTitle, artifactType });
      setDialogOpen(false);
      window.location.href = `/content/studio/${p.id}`;
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  async function handleDeleteProject(projectId: string) {
    const ok = window.confirm("Delete this project? This action cannot be undone.");
    if (!ok) return;
    try {
      await del.mutateAsync(projectId);
    } catch (_err) {
      // keep simple UX for now
      window.alert("Failed to delete project");
    }
  }

  return (
    <PageShell>
      <PageHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-page-title">Content Studio</h1>
          <p className="mt-1 type-body-sm text-muted-foreground">
            Chat-driven generation for decks, one-pagers, and images — preview in HTML, export when ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/content/templates">Templates</Link>
          </Button>
          <Button onClick={openCreateDialog} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            New project
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <p className="type-body-sm text-muted-foreground">Loading projects…</p>
      ) : deepLinkStatus ? (
        <div className="rounded-md border border-border bg-muted/30 p-4 type-body-sm text-muted-foreground">
          {deepLinkStatus}
        </div>
      ) : projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle>{p.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="type-caption text-muted-foreground capitalize">
                  {p.artifactType} · {p.status}
                </p>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/content/studio/${p.id}`}>Open studio</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={del.isPending}
                    onClick={() => void handleDeleteProject(p.id)}
                    aria-label="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="No studio projects yet"
          description="Start a new project to generate content with the Content Generation Agent."
          action={{ label: "New project", onClick: openCreateDialog }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create studio project</DialogTitle>
            <DialogDescription>
              Create a new content project to generate a deck, one pager, or image in Studio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="studio-project-title">Project title</Label>
              <Input
                id="studio-project-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q3 Retail Pitch Deck"
                disabled={create.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-project-type">Artifact type</Label>
              <select
                id="studio-project-type"
                value={artifactType}
                onChange={(e) =>
                  setArtifactType(e.target.value as (typeof ARTIFACT_TYPES)[number]["value"])
                }
                disabled={create.isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 type-body ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ARTIFACT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {createError ? <p className="type-body text-destructive">{createError}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleNew()}
              disabled={create.isPending || !title.trim()}
            >
              {create.isPending ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function artifactTypeFromDeepLink(
  template: string | null,
  asset: string | null
): (typeof ARTIFACT_TYPES)[number]["value"] {
  const value = `${template ?? ""} ${asset ?? ""}`.toLowerCase();
  if (value.includes("image") || value.includes("visual") || value.includes("social")) return "image";
  if (
    value.includes("one_pager") ||
    value.includes("one-pager") ||
    value.includes("one pager") ||
    value.includes("case") ||
    value.includes("battlecard") ||
    value.includes("architecture")
  ) {
    return "one_pager";
  }
  return "deck";
}

function projectTitleFromDeepLink({
  asset,
  account,
  artifactType,
}: {
  asset: string | null;
  account: string | null;
  artifactType: (typeof ARTIFACT_TYPES)[number]["value"];
}) {
  const label =
    artifactType === "one_pager" ? "One-pager" : artifactType === "image" ? "Image" : "Deck";
  if (asset && account) return `${account} - ${asset}`;
  if (asset) return asset;
  if (account) return `${account} ${label}`;
  return `New ${label.toLowerCase()}`;
}

function buildBriefFromDeepLink(options: {
  artifactType: (typeof ARTIFACT_TYPES)[number]["value"];
  template: string | null;
  source: string | null;
  asset: string | null;
  account: string | null;
  callId: string | null;
  lead: string | null;
  leadCount: string | null;
}) {
  const sourceLabel = options.source === "post-dc" ? "post-call" : options.source === "pre-dc" ? "pre-call" : "workflow";
  const points = [
    options.asset ? `Create the missing asset: ${options.asset}` : "",
    options.account ? `Tailor the content for ${options.account}` : "",
    options.leadCount ? `Reusable for ${options.leadCount} lead(s)` : "",
  ].filter(Boolean);

  return {
    artifact_type: options.artifactType,
    source: options.source,
    source_template: options.template,
    source_asset: options.asset,
    source_call_id: options.callId,
    source_lead: options.lead,
    source_lead_count: options.leadCount,
    audience: options.account ? `${options.account} buying committee` : "",
    pain_points_coverage: points,
    key_points: points,
    content_context: `${sourceLabel} content gap${options.asset ? `: ${options.asset}` : ""}`,
    style: "sales enablement draft",
  };
}

function seedMessageFromDeepLink(options: {
  title: string;
  artifactType: (typeof ARTIFACT_TYPES)[number]["value"];
  source: string | null;
  asset: string | null;
  account: string | null;
  leadCount: string | null;
}) {
  const artifact = options.artifactType === "one_pager" ? "one-pager" : options.artifactType;
  return [
    `Create a ${artifact} project called "${options.title}".`,
    options.source ? `Source workflow: ${options.source}.` : "",
    options.asset ? `Missing asset: ${options.asset}.` : "",
    options.account ? `Account context: ${options.account}.` : "",
    options.leadCount ? `Make it reusable across ${options.leadCount} lead(s).` : "",
    "Use this context to ask only for the next missing decision before drafting.",
  ]
    .filter(Boolean)
    .join("\n");
}
