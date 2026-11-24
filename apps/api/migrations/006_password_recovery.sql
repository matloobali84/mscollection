CREATE TABLE IF NOT EXISTS account_reset_tokens (token_hash text PRIMARY KEY,customer_id text NOT NULL REFERENCES customers(id),expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS account_reset_customer ON account_reset_tokens(customer_id);
