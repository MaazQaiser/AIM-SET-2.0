-- Customer Landing Pages (CLP), proposals, visitors, sessions, events, notifications

CREATE TABLE IF NOT EXISTS customer_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'revoked')),
  share_token TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  published_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, call_id)
);

CREATE INDEX IF NOT EXISTS customer_landing_pages_tenant_call_idx
  ON customer_landing_pages (tenant_id, call_id);

CREATE INDEX IF NOT EXISTS customer_landing_pages_share_token_idx
  ON customer_landing_pages (share_token);

CREATE TABLE IF NOT EXISTS clp_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  landing_page_id UUID NOT NULL REFERENCES customer_landing_pages(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published_on_clp')),
  version INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Proposal',
  html TEXT NOT NULL DEFAULT '',
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  template_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clp_proposals_landing_page_idx
  ON clp_proposals (landing_page_id, version DESC);

ALTER TABLE customer_landing_pages
  ADD CONSTRAINT customer_landing_pages_proposal_fk
  FOREIGN KEY (proposal_id) REFERENCES clp_proposals(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS clp_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES customer_landing_pages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  visit_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (landing_page_id, email)
);

CREATE INDEX IF NOT EXISTS clp_visitors_landing_page_idx
  ON clp_visitors (landing_page_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS clp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES customer_landing_pages(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES clp_visitors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS clp_sessions_landing_page_idx
  ON clp_sessions (landing_page_id, started_at DESC);

CREATE TABLE IF NOT EXISTS clp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES customer_landing_pages(id) ON DELETE CASCADE,
  session_id UUID REFERENCES clp_sessions(id) ON DELETE SET NULL,
  visitor_id UUID REFERENCES clp_visitors(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clp_events_landing_page_idx
  ON clp_events (landing_page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clp_events_type_idx
  ON clp_events (landing_page_id, event_type);

CREATE TABLE IF NOT EXISTS clp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  landing_page_id UUID NOT NULL REFERENCES customer_landing_pages(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clp_notifications_recipient_idx
  ON clp_notifications (recipient_user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS clp_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES customer_landing_pages(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES clp_visitors(id) ON DELETE SET NULL,
  session_id UUID REFERENCES clp_sessions(id) ON DELETE SET NULL,
  section_id TEXT,
  author_type TEXT NOT NULL CHECK (author_type IN ('visitor', 'ae')),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  parent_id UUID REFERENCES clp_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clp_comments_landing_page_idx
  ON clp_comments (landing_page_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clp_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES customer_landing_pages(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES clp_visitors(id) ON DELETE CASCADE,
  session_id UUID REFERENCES clp_sessions(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('visitor', 'ae')),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clp_chat_messages_landing_page_idx
  ON clp_chat_messages (landing_page_id, created_at ASC);
