"use client";

import { useState } from "react";
import Link from "next/link";
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
  const { data: projects = [], isLoading } = useStudioProjects();
  const create = useCreateStudioProject();
  const del = useDeleteStudioProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("New deck");
  const [artifactType, setArtifactType] = useState<(typeof ARTIFACT_TYPES)[number]["value"]>("deck");
  const [createError, setCreateError] = useState<string>("");

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Content Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chat-driven generation for decks, one-pagers, and images — preview in HTML, export when ready.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/content/templates">Templates</Link>
          </Button>
          <Button onClick={openCreateDialog} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            New project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="hover:shadow-soft-sm transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground capitalize">
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ARTIFACT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
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
    </div>
  );
}
