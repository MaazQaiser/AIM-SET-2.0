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
