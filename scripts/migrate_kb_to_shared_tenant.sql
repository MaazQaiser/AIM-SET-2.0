-- One-time: move all KB assets/chunks/jobs into the shared tenant.
-- Prerequisite: tenants row exists for clerk_org_id = 'dc-copilot-shared'
-- (start API with KB_SHARED_MODE=true and open Knowledge base once, or insert manually).

DO $$
DECLARE
  shared_id UUID;
BEGIN
  SELECT id INTO shared_id FROM tenants WHERE clerk_org_id = 'dc-copilot-shared' LIMIT 1;

  IF shared_id IS NULL THEN
    INSERT INTO tenants (clerk_org_id, name)
    VALUES ('dc-copilot-shared', 'Shared KB')
    RETURNING id INTO shared_id;
  END IF;

  UPDATE kb_assets SET tenant_id = shared_id WHERE tenant_id IS DISTINCT FROM shared_id;
  UPDATE kb_chunks SET tenant_id = shared_id WHERE tenant_id IS DISTINCT FROM shared_id;
  UPDATE kb_ingest_jobs SET tenant_id = shared_id WHERE tenant_id IS DISTINCT FROM shared_id;
END $$;
