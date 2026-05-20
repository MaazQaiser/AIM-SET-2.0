"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bffFetch } from "@/lib/api/bff-fetch";
import type {
  ContentExportResult,
  ContentTemplate,
  StudioProject,
  StudioTurnResult,
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
  revisions: Array<{ id: string; projectId: string; createdAt: string; templateId?: string | null }>;
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
    mutationFn: async (body: { title: string; artifactType: string }) => {
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
