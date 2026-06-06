"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bffFetch } from "@/lib/api/bff-fetch";
import type {
  ContentExportResult,
  ContentTemplate,
  ContentTemplateDraft,
  CreateStudioProjectInput,
  StudioRevision,
  StudioRevisionKbSaveResult,
  StudioRevisionRestoreResult,
  StudioKbSaveFormat,
  StudioProject,
  StudioTurnResult,
  TemplateAssistResult,
} from "@/types/content_studio";

export interface StudioProjectDetail {
  project: StudioProject;
  messages: Array<{
    id: string;
    role: string;
    turnType?: string | null;
    content: Record<string, unknown>;
    createdAt: string;
  }>;
  revisions: Array<{
    id: string;
    projectId: string;
    createdAt: string;
    templateId?: string | null;
  }>;
  latestRevision?: { id: string; html: string; citations?: unknown[] } | null;
}

export function useStudioProjects() {
  return useQuery({
    queryKey: ["studio-projects"],
    queryFn: async () => {
      const api = await bffFetch<StudioProject[]>("/api/content/studio/projects");
      return api ?? [];
    },
    staleTime: 15_000,
  });
}

export function useStudioProject(projectId: string) {
  return useQuery({
    queryKey: ["studio-project", projectId],
    queryFn: async () => {
      const api = await bffFetch<StudioProjectDetail>(`/api/content/studio/projects/${projectId}`);
      if (!api) throw new Error("Project not found");
      return api;
    },
    enabled: Boolean(projectId),
    refetchInterval: 5_000,
  });
}

export function useContentTemplates(artifactType?: string) {
  return useQuery({
    queryKey: ["content-templates", artifactType],
    queryFn: async () => {
      const qs = artifactType ? `?artifactType=${encodeURIComponent(artifactType)}` : "";
      const api = await bffFetch<ContentTemplate[]>(`/api/content/templates${qs}`);
      return api ?? [];
    },
    staleTime: 10_000,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data?.some((t) => t.status === "processing")) return 3_000;
      return false;
    },
  });
}

export function useContentTemplate(templateId?: string) {
  return useQuery({
    queryKey: ["content-template", templateId],
    queryFn: async () => {
      const api = await bffFetch<ContentTemplate>(`/api/content/templates/${templateId}`);
      if (!api) throw new Error("Template not found");
      return api;
    },
    enabled: Boolean(templateId),
    staleTime: 30_000,
  });
}

export function useCreateStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateStudioProjectInput & { callId?: string; gapId?: string }) => {
      const res = await fetch("/api/content/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<StudioProject>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio-projects"] }),
  });
}

export function useStudioRevision(projectId: string, revisionId?: string) {
  return useQuery({
    queryKey: ["studio-revision", projectId, revisionId],
    queryFn: async () => {
      const api = await bffFetch<StudioRevision>(
        `/api/content/studio/projects/${projectId}/revisions/${revisionId}`
      );
      if (!api) throw new Error("Revision not found");
      return api;
    },
    enabled: Boolean(projectId && revisionId),
  });
}

export function useDeleteStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/content/studio/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ status: string; projectId: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio-projects"] }),
  });
}

export function useStudioBootstrap(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/content/studio/projects/${projectId}/bootstrap`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        agent: string;
        operation: string;
        result: StudioTurnResult;
        citations?: unknown[];
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-project", projectId] });
      qc.invalidateQueries({ queryKey: ["studio-projects"] });
    },
  });
}

export function useStudioMessage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { message: string; templateId?: string; generate?: boolean }) => {
      const res = await fetch(`/api/content/studio/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        agent: string;
        operation: string;
        result: StudioTurnResult;
        citations?: unknown[];
      }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-project", projectId] });
      qc.invalidateQueries({ queryKey: ["studio-projects"] });
    },
  });
}

export function useStudioExport(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { revisionId: string; format: string }) => {
      const res = await fetch(`/api/content/studio/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId: body.revisionId, format: body.format }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ContentExportResult>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-project", projectId] });
      qc.invalidateQueries({ queryKey: ["studio-projects"] });
    },
  });
}

export function useRestoreStudioRevision(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (revisionId: string) => {
      const res = await fetch(
        `/api/content/studio/projects/${projectId}/revisions/${revisionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<StudioRevisionRestoreResult>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-project", projectId] });
      qc.invalidateQueries({ queryKey: ["studio-projects"] });
    },
  });
}

export function useSaveRevisionToKb(projectId: string) {
  return useMutation({
    mutationFn: async (body: {
      revisionId: string;
      title?: string;
      tags?: string[];
      format: StudioKbSaveFormat;
    }) => {
      const res = await fetch(
        `/api/content/studio/projects/${projectId}/revisions/${body.revisionId}/save-to-kb`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: body.title, tags: body.tags ?? [], format: body.format }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<StudioRevisionKbSaveResult>;
    },
  });
}

export function useTemplateUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FormData) => {
      const res = await fetch("/api/content/templates/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-templates"] }),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ContentTemplateDraft) => {
      const res = await fetch("/api/content/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ContentTemplate>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-templates"] }),
  });
}

export function useUpdateTemplate(templateId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ContentTemplateDraft) => {
      if (!templateId) throw new Error("Template id is required");
      const res = await fetch(`/api/content/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ContentTemplate>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-templates"] });
      qc.invalidateQueries({ queryKey: ["content-template", templateId] });
    },
  });
}

export function useTemplateAssist() {
  return useMutation({
    mutationFn: async (
      body: ContentTemplateDraft & {
        instruction: string;
      }
    ) => {
      const res = await fetch("/api/content/templates/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<TemplateAssistResult>;
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/content/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ status: string; templateId: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-templates"] }),
  });
}

export function useSubmitStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/content/studio/projects/${projectId}/submit-review`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<StudioProject>;
    },
    onSuccess: (_data, projectId) => {
      qc.invalidateQueries({ queryKey: ["studio-projects"] });
      qc.invalidateQueries({ queryKey: ["studio-project", projectId] });
    },
  });
}

export function useApproveStudioProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/content/studio/projects/${projectId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ projectId: string; asset: { id: string; title: string } }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["studio-projects"] });
      qc.invalidateQueries({ queryKey: ["kb-assets"] });
      qc.invalidateQueries({ queryKey: ["content-gaps"] });
    },
  });
}
