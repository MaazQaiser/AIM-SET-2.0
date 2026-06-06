export type StudioArtifactType = "deck" | "one_pager" | "image" | "case_study";

export type TemplateStatus = "processing" | "ready" | "failed";

export type StudioProjectStatus = "drafting" | "preview" | "exported" | "pending_review" | "published";

export type StudioTurnType = "ask" | "recommend" | "outline" | "html" | "patch" | "refuse" | "unknown";

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
  sourceFileName?: string;
  hasSourceFile?: boolean;
  previewSlideCount?: number;
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
    mode?: SlidePlanMode;
    evidence?: string;
    citation_source?: string;
    reuse?: SlideReuseSpec;
  }>;
  slide_plan?: SlidePlanItem[];
  suggestion_plan?: SuggestionPlan;
  recommended_templates?: Array<{ template_id: string; rationale: string }>;
  kb_matches?: Array<{ asset_id: string; title: string; snippet?: string }>;
  revision_id?: string;
  html?: string;
  patch?: { slide: number; html: string };
  message?: string;
  template_id?: string;
}

export type SlidePlanMode = "generate" | "reuse" | "hybrid";

export interface SlideReuseSpec {
  source_asset_id: string;
  source_slide_index: number;
  source_vertical?: string;
  rationale?: string;
}

export interface SlidePlanItem {
  slide: number;
  heading: string;
  body?: string;
  intent?: string;
  visual?: string;
  mode?: SlidePlanMode;
  evidence_refs?: string[];
  data_points?: string[];
  reuse?: SlideReuseSpec;
}

export interface SuggestionPlanEvidenceProject {
  asset_id: string;
  title: string;
  source: string;
  snippet?: string;
  score?: number;
}

export interface SuggestionPlanEvidenceKb {
  asset_id: string;
  title: string;
  snippet?: string;
  slide_count?: number;
  score?: number;
}

export interface SuggestionPlan {
  suggestion_id: string;
  source: string;
  generation_reason?: string;
  needed_for?: string;
  lead_count?: number;
  leads?: Array<{
    call_id?: string;
    account_name?: string;
    lead_name?: string;
    industry?: string;
  }>;
  industry?: string;
  artifact_type?: string;
  title?: string;
  plan_summary?: string;
  evidence?: {
    projects?: SuggestionPlanEvidenceProject[];
    kb_assets?: SuggestionPlanEvidenceKb[];
  };
  template?: {
    template_id?: string;
    name?: string;
    rationale?: string;
  };
  recommended_templates?: Array<{ template_id: string; rationale: string }>;
  slide_plan?: SlidePlanItem[];
}

export interface ContentPlanInput {
  suggestionId: string;
  title: string;
  artifactType: string;
  source?: "pre-dc" | "post-dc";
  generationReason?: string;
  neededFor?: string;
  industry?: string;
  leads?: Array<{
    callId?: string;
    accountName?: string;
    leadName?: string;
    industry?: string;
  }>;
  kbAssetIds?: string[];
}

export interface ContentPlanResult {
  suggestion_plan: SuggestionPlan;
  slide_outline?: StudioTurnResult["slide_outline"];
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
