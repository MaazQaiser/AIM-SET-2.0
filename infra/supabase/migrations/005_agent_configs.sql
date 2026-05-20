-- Per-tenant agent configuration (model policy, cost caps, guardrails, prompts, etc.)

CREATE TABLE IF NOT EXISTS agent_configs (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, agent_id)
);

CREATE INDEX IF NOT EXISTS agent_configs_tenant_idx ON agent_configs (tenant_id);

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
