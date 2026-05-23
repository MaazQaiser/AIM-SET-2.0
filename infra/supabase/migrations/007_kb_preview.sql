-- KB asset visual preview (e.g. PPTX converted to PDF for iframe viewing)

ALTER TABLE kb_assets
  ADD COLUMN IF NOT EXISTS preview_storage_path TEXT;
