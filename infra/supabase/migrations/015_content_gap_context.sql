-- Add traceability and generation context to AI-detected content gaps.

ALTER TABLE content_gaps
  ADD COLUMN IF NOT EXISTS source_path TEXT,
  ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS content_gaps_source_path_idx
  ON content_gaps (tenant_id, source_path);
