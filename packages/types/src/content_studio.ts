export type StudioArtifactType = "deck" | "one_pager" | "image";

export type TemplateStatus = "processing" | "ready" | "failed";

export type StudioProjectStatus = "drafting" | "preview" | "exported";

export type StudioTurnType = "ask" | "recommend" | "html" | "patch" | "refuse" | "unknown";

export type ExportFormat = "pdf" | "png" | "pptx";

export type StudioKbSaveFormat = "pdf" | "pptx" | "csv";

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

export interface ContentTemplateDraft {
  name: string;
  artifactType: StudioArtifactType;
  tags: string[];
  html: string;
  css: string;
}

export interface TemplateAssistResult {
  html: string;
  css: string;
  message: string;
  model?: string;
  costUsd?: number;
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

export interface CreateStudioProjectInput {
  title: string;
  artifactType: StudioArtifactType;
  templateId?: string | null;
  brief?: Record<string, unknown>;
  recommendedTemplateIds?: string[];
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
  slide_outline?: Array<{
    slide: number;
    heading: string;
    body: string;
    visual?: string;
  }>;
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

export interface StudioRevisionRestoreResult {
  revision: StudioRevision;
  project: StudioProject;
}

export interface StudioRevisionKbSaveResult {
  asset: {
    id: string;
    title: string;
    type: string;
    tags: string[];
    uploadedAt: string;
    version: number;
    status?: string;
    fileName?: string;
    mimeType?: string;
  };
  job?: {
    id: string;
    assetId: string;
    status: string;
    stage: string;
    progressPct: number;
  };
  format?: StudioKbSaveFormat;
}
