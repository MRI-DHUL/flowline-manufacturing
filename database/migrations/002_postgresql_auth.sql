CREATE TABLE flowline.auth_accounts (
  user_profile_id uuid PRIMARY KEY
    REFERENCES flowline.user_profiles(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  password_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT auth_accounts_password_hash_format
    CHECK (password_hash LIKE '$argon2id$%'),
  CONSTRAINT auth_accounts_failed_attempts_nonnegative
    CHECK (failed_attempts >= 0)
);

CREATE TRIGGER auth_accounts_set_updated_at
BEFORE UPDATE ON flowline.auth_accounts
FOR EACH ROW EXECUTE FUNCTION flowline.set_updated_at();

CREATE TABLE flowline.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid NOT NULL
    REFERENCES flowline.user_profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  CONSTRAINT auth_sessions_token_hash_format
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT auth_sessions_expiry_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT auth_sessions_revoked_after_creation
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX auth_sessions_active_lookup_idx
  ON flowline.auth_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX auth_sessions_user_idx
  ON flowline.auth_sessions (user_profile_id, created_at DESC);