-- Content gaps: AI-detected missing assets and workflow linkage to Studio / KB

CREATE TABLE IF NOT EXISTS content_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('pre_dc', 'post_dc')),
  gap_key TEXT NOT NULL,
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL DEFAULT 'deck',
  reason TEXT,
  needed_for TEXT,
  priority INT NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  studio_project_id UUID REFERENCES content_studio_projects(id) ON DELETE SET NULL,
  kb_asset_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, gap_key)
);

CREATE INDEX IF NOT EXISTS content_gaps_tenant_status_idx
  ON content_gaps (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS content_gaps_call_idx
  ON content_gaps (tenant_id, call_id);
