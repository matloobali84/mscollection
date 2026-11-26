ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_started_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_email text NOT NULL DEFAULT '';
