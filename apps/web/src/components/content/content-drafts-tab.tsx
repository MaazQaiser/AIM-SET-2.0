"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
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
  useApproveStudioProject,
  useCreateStudioProject,
  useDeleteStudioProject,
  useStudioProjects,
} from "@/lib/data/content-studio-hooks";
import { usePersona } from "@/hooks/use-persona";

const ARTIFACT_TYPES = [
  { value: "deck", label: "Deck" },
  { value: "case_study", label: "Case study" },
  { value: "one_pager", label: "One pager" },
  { value: "image", label: "Image" },
] as const;

const statusBadge: Record<string, "secondary" | "warning" | "success" | "outline"> = {
  drafting: "secondary",
  preview: "warning",
  pending_review: "warning",
  published: "success",
  exported: "outline",
};

export function ContentDraftsTab() {
  const router = useRouter();
  const persona = usePersona();
  const { data: projects = [], isLoading } = useStudioProjects();
  const create = useCreateStudioProject();
  const del = useDeleteStudioProject();
  const approve = useApproveStudioProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("New deck");
  const [artifactType, setArtifactType] = useState<(typeof ARTIFACT_TYPES)[number]["value"]>("deck");
  const [createError, setCreateError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const isContentOwner = persona === "content-owner" || persona === "leadership";

  function openCreateDialog() {
    setCreateError("");
    setTitle("New deck");
    setArtifactType("deck");
    setDialogOpen(true);
  }

  async function handleNew() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setCreateError("Content title is required.");
      return;
    }
    try {
      const p = await create.mutateAsync({ title: trimmedTitle, artifactType });
      setDialogOpen(false);
      router.push(`/content/studio/${p.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create content");
    }
  }

  async function handleDeleteProject(projectId: string) {
    const ok = window.confirm("Delete this content? This action cannot be undone.");
    if (!ok) return;
    try {
      await del.mutateAsync(projectId);
    } catch {
      window.alert("Failed to delete content");
    }
  }

  async function handleApprove(projectId: string) {
    setApprovingId(projectId);
    try {
      await approve.mutateAsync(projectId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to publish to library");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="type-body-sm text-muted-foreground">
          In-progress and review-ready content. Approved items are published to the library.
        </p>
        <Button onClick={openCreateDialog} disabled={create.isPending} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Content
        </Button>
      </div>

      {isLoading ? (
        <p className="type-body-sm text-muted-foreground">Loading content…</p>
      ) : projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{p.title}</CardTitle>
                  <Badge variant={statusBadge[p.status] ?? "secondary"} className="capitalize shrink-0">
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="type-caption text-muted-foreground capitalize">{p.artifactType}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/content/studio/${p.id}`}>Open in Studio</Link>
                  </Button>
                  {isContentOwner && (p.status === "preview" || p.status === "pending_review") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={approvingId === p.id}
                      onClick={() => void handleApprove(p.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {approvingId === p.id ? "Publishing…" : "Approve to library"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={del.isPending}
                    onClick={() => void handleDeleteProject(p.id)}
                    aria-label="Delete content"
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
          title="No content yet"
          description="Generate content from a suggestion or create new content in Studio."
          action={{ label: "New Content", onClick: openCreateDialog }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New content</DialogTitle>
            <DialogDescription>
              Create content in Studio — a deck, one pager, or image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="studio-content-title">Content title</Label>
              <Input
                id="studio-content-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q3 Retail Pitch Deck"
                disabled={create.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-content-type">Content type</Label>
              <select
                id="studio-content-type"
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
              {create.isPending ? "Creating…" : "Create content"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
