-- Preserve live-call transcript analysis for refresh and post-call review.

ALTER TABLE call_transcript_events
  ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative'));

ALTER TABLE call_transcript_events
  ADD COLUMN IF NOT EXISTS signal_type TEXT;
