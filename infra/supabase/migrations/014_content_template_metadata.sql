-- Persist source-deck understanding for template preview and future generation planning.

ALTER TABLE content_templates
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
