export type StudioArtifactType = "deck" | "one_pager" | "image";

export type TemplateStatus = "processing" | "ready" | "failed";

export type StudioProjectStatus = "drafting" | "preview" | "exported";

export type StudioTurnType = "ask" | "recommend" | "html" | "patch" | "refuse" | "unknown";

export type ExportFormat = "pdf" | "png" | "pptx";

export interface ContentTemplate {
  id: string;
  name: string;
  artifactType: StudioArtifactType;
  status: TemplateStatus;
  pageCount: number;
  tags: string[];
  thumbnailUrl?: string;
  cssVariables: Record<string, string>;
  createdAt: string;
  ingestError?: string;
  html?: string;
}

export interface StudioProject {
  id: string;
  title: string;
  artifactType: StudioArtifactType;
  templateId?: string | null;
  status: StudioProjectStatus;
  brief: Record<string, unknown>;
  recommendedTemplateIds: string[];
  costUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioMessage {
  id: string;
  role: "user" | "assistant" | "system";
  turnType?: StudioTurnType | null;
  content: Record<string, unknown>;
  createdAt: string;
}

export interface StudioRevision {
  id: string;
  projectId: string;
  html?: string;
  citations?: Array<{
    source_type: string;
    source_id: string;
    snippet?: string;
    confidence?: number;
  }>;
  templateId?: string | null;
  createdAt: string;
}

export interface StudioTurnResult {
  project_id: string;
  turn_type: StudioTurnType;
  ask?: string[];
  recommended_templates?: Array<{ template_id: string; rationale: string }>;
  revision_id?: string;
  html?: string;
  patch?: { slide: number; html: string };
  message?: string;
  template_id?: string;
}

export interface ContentExportResult {
  id: string;
  format: ExportFormat;
  downloadUrl: string;
  byteSize: number;
}
