-- Content Studio: templates, projects, chat, revisions, exports

CREATE TABLE IF NOT EXISTS content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('deck', 'one_pager', 'image')),
  status TEXT NOT NULL DEFAULT 'processing',
  source_file_name TEXT,
  source_storage_path TEXT,
  thumbnail_storage_path TEXT,
  html TEXT,
  css_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_count INT NOT NULL DEFAULT 1,
  ingest_error TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_templates_tenant_idx
  ON content_templates (tenant_id, artifact_type, created_at DESC);

CREATE TABLE IF NOT EXISTS content_studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('deck', 'one_pager', 'image')),
  template_id UUID REFERENCES content_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'drafting',
  brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_template_ids UUID[] NOT NULL DEFAULT '{}',
  cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_studio_projects_tenant_idx
  ON content_studio_projects (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS content_studio_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES content_studio_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  turn_type TEXT,
  content JSONB NOT NULL,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_studio_messages_project_idx
  ON content_studio_messages (project_id, created_at);

CREATE TABLE IF NOT EXISTS content_studio_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES content_studio_projects(id) ON DELETE CASCADE,
  html TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  template_id UUID REFERENCES content_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_studio_revisions_project_idx
  ON content_studio_revisions (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES content_studio_revisions(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'png', 'pptx')),
  storage_path TEXT NOT NULL,
  byte_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-templates', 'content-templates', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-exports', 'content-exports', false)
ON CONFLICT (id) DO NOTHING;
