-- Live call transcript, suggestions audit, and provider session linking

CREATE TABLE IF NOT EXISTS call_live_sessions (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  provider TEXT NOT NULL DEFAULT 'recall',
  provider_meeting_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, call_id)
);

CREATE INDEX IF NOT EXISTS call_live_sessions_provider_idx
  ON call_live_sessions (tenant_id, provider_meeting_id);

CREATE TABLE IF NOT EXISTS call_transcript_events (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  speaker_id TEXT NOT NULL DEFAULT 'unknown',
  speaker_role TEXT,
  text TEXT NOT NULL,
  offset_seconds NUMERIC NOT NULL DEFAULT 0,
  keywords JSONB NOT NULL DEFAULT '[]',
  provider TEXT NOT NULL DEFAULT 'recall',
  provider_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, call_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS call_transcript_events_provider_dedupe_idx
  ON call_transcript_events (tenant_id, call_id, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS call_transcript_events_call_time_idx
  ON call_transcript_events (tenant_id, call_id, created_at);

CREATE TABLE IF NOT EXISTS live_call_suggestions (
  id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  target_role TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  transcript_offset_seconds NUMERIC NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'shown' CHECK (status IN ('shown', 'accepted', 'dismissed', 'expired')),
  shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_at TIMESTAMPTZ,
  trace_id TEXT,
  PRIMARY KEY (tenant_id, call_id, id)
);

CREATE INDEX IF NOT EXISTS live_call_suggestions_call_time_idx
  ON live_call_suggestions (tenant_id, call_id, shown_at DESC);

ALTER TABLE call_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcript_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_call_suggestions ENABLE ROW LEVEL SECURITY;
