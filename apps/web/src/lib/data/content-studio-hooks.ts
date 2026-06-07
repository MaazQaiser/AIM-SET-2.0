"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bffFetch } from "@/lib/api/bff-fetch";
import { QUERY_STALE_TIME_MS } from "@/lib/data/query-cache";
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

const TEMPLATE_SAVE_TIMEOUT_MS = 20_000;

async function fetchTemplateWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TEMPLATE_SAVE_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Save timed out after 20s. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

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
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useStudioProject(
  projectId: string,
  options: { includeLatest?: boolean } = {}
) {
  const includeLatest = options.includeLatest ?? true;
  return useQuery({
    queryKey: ["studio-project", projectId, { includeLatest }],
    queryFn: async () => {
      const query = includeLatest ? "" : "?includeLatest=false";
      const api = await bffFetch<StudioProjectDetail>(
        `/api/content/studio/projects/${projectId}${query}`
      );
      if (!api) throw new Error("Project not found");
      return api;
    },
    enabled: Boolean(projectId),
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useContentTemplates(artifactType?: string) {
  // Always fetch ALL templates with a single stable cache key, then filter
  // client-side. This avoids a race condition where changing the query key
  // (undefined → "deck") briefly shows [] while the new fetch is in-flight.
  return useQuery({
    queryKey: ["content-templates"],
    queryFn: async () => {
      const api = await bffFetch<ContentTemplate[]>("/api/content/templates");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
    select: (all) =>
      artifactType ? all.filter((t) => !t.artifactType || t.artifactType === artifactType) : all,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data?.some((t) => t.status === "processing")) return 3_000;
      return false;
    },
  });
}

export function useContentTemplate(templateId?: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["content-template", templateId],
    queryFn: async () => {
      const api = await bffFetch<ContentTemplate>(`/api/content/templates/${templateId}`);
      if (!api) throw new Error("Template not found");
      return api;
    },
    enabled: Boolean(templateId),
    staleTime: QUERY_STALE_TIME_MS,
    // Show template instantly from list cache while fetching fresh detail.
    placeholderData: () => {
      if (!templateId) return undefined;
      const list = qc.getQueryData<ContentTemplate[]>(["content-templates"]);
      return list?.find((template) => template.id === templateId);
    },
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
    staleTime: QUERY_STALE_TIME_MS,
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
      const res = await fetchTemplateWithTimeout("/api/content/templates", {
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
      const res = await fetchTemplateWithTimeout(`/api/content/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return res.json() as Promise<ContentTemplate>;

      // Final safety net: if update target is stale/missing, create a fresh
      // template from the current editor draft instead of failing the save.
      if (res.status === 404) {
        const createRes = await fetchTemplateWithTimeout("/api/content/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!createRes.ok) throw new Error(await createRes.text());
        return createRes.json() as Promise<ContentTemplate>;
      }

      throw new Error(await res.text());
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

const PARENT_TEMPLATE_TAG = "__parent_template__";
const PARENT_TEMPLATE_FETCH_TIMEOUT_MS = 120_000;
const PARENT_TEMPLATE_SAVE_TIMEOUT_MS = 120_000;

async function fetchParentTemplate(): Promise<ContentTemplate | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PARENT_TEMPLATE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/content/templates/parent", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as ContentTemplate | null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Loads the singleton parent template (includes metadata for scratch builder). */
export function useParentTemplate() {
  return useQuery({
    queryKey: ["content-parent-template"],
    queryFn: fetchParentTemplate,
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useSaveParentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ContentTemplateDraft) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), PARENT_TEMPLATE_SAVE_TIMEOUT_MS);
      try {
        const res = await fetch("/api/content/templates/parent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<ContentTemplate>;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("Save timed out. Your images may be very large — try again or use smaller images.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeout);
      }
    },
    onSuccess: (savedTemplate) => {
      qc.setQueryData<ContentTemplate | null>(["content-parent-template"], savedTemplate);
      qc.setQueryData<ContentTemplate[]>(["content-templates"], (old) => {
        const withoutParent = (old ?? []).filter(
          (t) => !t.tags?.includes(PARENT_TEMPLATE_TAG)
        );
        return [savedTemplate, ...withoutParent];
      });
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
