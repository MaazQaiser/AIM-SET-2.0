-- Track when visual slide previews were last regenerated (cache busting / UI freshness)

ALTER TABLE kb_assets
  ADD COLUMN IF NOT EXISTS preview_updated_at TIMESTAMPTZ;
