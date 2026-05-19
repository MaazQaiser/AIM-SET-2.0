-- Run once on a fresh Supabase project (combines 001, 002, 003)
-- DC Copilot foundation schema (Supabase Postgres + pgvector)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  cost_cap_monthly_usd NUMERIC(10, 2) DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'ae',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_slug TEXT NOT NULL,
  account_name TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  brief_ready BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS call_briefs (
  call_id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]',
  agent_trace_id TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, call_id, version)
);

CREATE TABLE IF NOT EXISTS pre_dc_records (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT,
  fields JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS post_dc_records (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT,
  matched_call_id TEXT,
  fields JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS kb_assets (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  storage_path TEXT,
  effectiveness_score NUMERIC(4, 3),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON kb_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  tokens_used INT NOT NULL DEFAULT 0,
  model_used TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  label TEXT NOT NULL,
  version TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT NOT NULL DEFAULT '',
  changelog TEXT NOT NULL DEFAULT ''
);

ALTER TABLE pre_dc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_dc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- KB ingestion (002)
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

INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-assets', 'kb-assets', false)
ON CONFLICT (id) DO NOTHING;

-- DC notes vector index (003)
CREATE INDEX IF NOT EXISTS kb_chunks_dc_note_idx
  ON kb_chunks (tenant_id, ((metadata->>'source')))
  WHERE (metadata->>'source') = 'dc_note';
