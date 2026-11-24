ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_at timestamptz;
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(status,created_at);
