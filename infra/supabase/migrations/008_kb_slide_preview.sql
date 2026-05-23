-- KB presentation visual preview: rasterized slide PNGs (LibreOffice render)

ALTER TABLE kb_assets
  ADD COLUMN IF NOT EXISTS preview_slide_count INT NOT NULL DEFAULT 0;
