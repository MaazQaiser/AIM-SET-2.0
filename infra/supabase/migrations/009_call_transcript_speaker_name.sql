-- Preserve human-readable participant names separately from Recall speaker ids.

ALTER TABLE call_transcript_events
  ADD COLUMN IF NOT EXISTS speaker_name TEXT;
