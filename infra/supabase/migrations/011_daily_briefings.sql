-- Cached daily dashboard briefing (one row per tenant per calendar day)

CREATE TABLE IF NOT EXISTS daily_briefings (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefings_generated_at
  ON daily_briefings (tenant_id, generated_at DESC);
