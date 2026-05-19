-- KB ingestion: job queue, asset status, vector search RPC

ALTER TABLE kb_assets
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS byte_size BIGINT,
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS ingest_error TEXT,
  ADD COLUMN IF NOT EXISTS chunk_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

ALTER TABLE kb_chunks
  ADD COLUMN IF NOT EXISTS chunk_index INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS kb_chunks_tenant_asset_idx ON kb_chunks (tenant_id, asset_id);

CREATE TABLE IF NOT EXISTS kb_ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT 'uploaded',
  progress_pct INT NOT NULL DEFAULT 0,
  error_message TEXT,
  worker_id TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_ingest_jobs_status_idx ON kb_ingest_jobs (status, created_at);

CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(1536),
  p_tenant_id UUID,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  asset_id TEXT,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.asset_id,
    c.chunk_text,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM kb_chunks c
  WHERE c.tenant_id = p_tenant_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION claim_kb_ingest_job(p_worker_id TEXT DEFAULT 'worker-1')
RETURNS SETOF kb_ingest_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  job kb_ingest_jobs;
BEGIN
  SELECT * INTO job
  FROM kb_ingest_jobs
  WHERE status = 'queued'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE kb_ingest_jobs
  SET
    status = 'processing',
    stage = 'parsing',
    progress_pct = 5,
    worker_id = p_worker_id,
    started_at = COALESCE(started_at, now())
  WHERE id = job.id
  RETURNING * INTO job;

  RETURN NEXT job;
END;
$$;

-- Storage bucket (run in Supabase dashboard if SQL storage API unavailable)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-assets', 'kb-assets', false)
ON CONFLICT (id) DO NOTHING;
