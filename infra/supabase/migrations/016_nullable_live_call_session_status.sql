-- Live call sessions should start in a null state until a provider or transcript activates them.

ALTER TABLE call_live_sessions
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE call_live_sessions
  ALTER COLUMN status DROP NOT NULL;

ALTER TABLE call_live_sessions
  DROP CONSTRAINT IF EXISTS call_live_sessions_status_check;

ALTER TABLE call_live_sessions
  ADD CONSTRAINT call_live_sessions_status_check
  CHECK (status IS NULL OR status IN ('live', 'ended'));
