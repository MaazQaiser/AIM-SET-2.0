-- DC notes are embedded into kb_chunks with metadata.source = 'dc_note'
CREATE INDEX IF NOT EXISTS kb_chunks_dc_note_idx
  ON kb_chunks (tenant_id, ((metadata->>'source')))
  WHERE (metadata->>'source') = 'dc_note';
