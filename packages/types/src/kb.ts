export type KBAssetStatus = "pending" | "processing" | "ready" | "failed";

export type KBIngestJobStatus = "queued" | "processing" | "done" | "failed";

export type KBIngestStage =
  | "uploaded"
  | "parsing"
  | "chunking"
  | "embedding"
  | "done"
  | "failed";

export interface KBIngestJob {
  id: string;
  assetId: string;
  status: KBIngestJobStatus;
  stage: KBIngestStage;
  progressPct: number;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
}

export interface KBUploadResponse {
  asset: KBAssetWithStatus;
  job: KBIngestJob;
}

export interface KBAssetWithStatus {
  id: string;
  title: string;
  type: string;
  tags: string[];
  uploadedAt: string;
  version: number;
  effectivenessScore?: number;
  lastUsed?: string;
  status?: KBAssetStatus;
  fileName?: string;
  mimeType?: string;
  chunkCount?: number;
  ingestError?: string;
}

export interface KBProject {
  id: string;
  title: string;
  projectName?: string;
  companyName?: string | null;
  summary: string;
  problemStatement?: string;
  businessOutcome?: string;
  functionalSolution?: string;
  technicalSolution?: string;
  industry?: string;
  sector?: string;
  domain?: string;
  subDomain?: string;
  companyStage?: string;
  startDate?: string;
  endDate?: string;
  definitionsUrl?: string;
  fields: Record<string, string>;
  sourceAssetId: string;
  sourceAssetIds?: string[];
  sourceAssetTitle: string;
  sourceFileName?: string;
  sourceUploadedAt?: string;
  sourceAssetType?: string;
  sourceCount: number;
  tags: string[];
}
