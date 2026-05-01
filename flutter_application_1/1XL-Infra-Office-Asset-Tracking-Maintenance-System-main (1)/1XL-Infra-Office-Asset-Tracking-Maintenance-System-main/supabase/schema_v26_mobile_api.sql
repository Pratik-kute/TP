-- =============================================================================
-- Schema v26 — Mobile API surface
-- =============================================================================
-- Adds the tables required by the standalone Express backend in `server/`:
--   * api_keys                 — org-scoped integration credentials
--   * api_key_usage_log        — per-call audit trail for API keys
--   * refresh_tokens           — JWT refresh-token rotation store
--   * idempotency_keys         — dedupe POST mutations
--   * repair_updates           — status-transition log per repair ticket
--   * audit_cycles / audit_verifications — mobile audit verify/flag
--   * asset_photos             — pending + active photos per asset
--
-- Also adds a `password_hash` column to `users` so the new server can move
-- away from plaintext password lookup. Existing rows keep their `password`
-- column populated — the server hashes on first successful login and
-- backfills `password_hash`. After every active user has logged in once,
-- the `password` column can be dropped manually.
--
-- Run AFTER all earlier `schema_vNN_*.sql` files. Idempotent — safe to
-- re-run.
-- =============================================================================

-- ---------- users.password_hash ---------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ---------- api_keys --------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  key_prefix           TEXT        NOT NULL,
  key_hash             TEXT        NOT NULL,
  scopes               TEXT[]      NOT NULL DEFAULT '{}',
  rate_limit_per_minute INTEGER    NOT NULL DEFAULT 120,
  created_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ,
  last_used_at         TIMESTAMPTZ,
  last_used_ip         TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  revoked_at           TIMESTAMPTZ,
  revoked_by           UUID        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS api_keys_org_idx       ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx    ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_active_idx    ON api_keys(is_active) WHERE is_active;

-- ---------- api_key_usage_log ----------------------------------------------
CREATE TABLE IF NOT EXISTS api_key_usage_log (
  id                BIGSERIAL    PRIMARY KEY,
  api_key_id        UUID         NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID         REFERENCES users(id) ON DELETE SET NULL,
  endpoint          TEXT         NOT NULL,
  method            TEXT         NOT NULL,
  status_code       INTEGER      NOT NULL,
  response_time_ms  INTEGER      NOT NULL DEFAULT 0,
  ip                TEXT,
  user_agent        TEXT,
  request_id        TEXT,
  error_code        TEXT,
  timestamp         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_key_usage_key_idx ON api_key_usage_log(api_key_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS api_key_usage_org_idx ON api_key_usage_log(organization_id, timestamp DESC);

-- ---------- refresh_tokens --------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,
  device_id     TEXT,
  user_agent    TEXT,
  ip            TEXT,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  replaced_by   UUID        REFERENCES refresh_tokens(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens(expires_at);

-- ---------- idempotency_keys -----------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key             TEXT        PRIMARY KEY,
  api_key_id      UUID        REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT        NOT NULL,
  method          TEXT        NOT NULL,
  request_hash    TEXT        NOT NULL,
  status_code     INTEGER     NOT NULL,
  response_body   JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx ON idempotency_keys(expires_at);

-- ---------- repair_updates --------------------------------------------------
CREATE TABLE IF NOT EXISTS repair_updates (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_id       UUID        NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  author_name     TEXT        NOT NULL DEFAULT '',
  status_from     TEXT,
  status_to       TEXT,
  note            TEXT        NOT NULL DEFAULT '',
  attachments     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repair_updates_repair_idx ON repair_updates(repair_id, created_at DESC);

-- ---------- audit_cycles + audit_verifications -----------------------------
CREATE TABLE IF NOT EXISTS audit_cycles (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_cycles_org_status_idx ON audit_cycles(organization_id, status);

CREATE TABLE IF NOT EXISTS audit_verifications (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id              UUID        NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
  asset_id              UUID        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  organization_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  verifier_id           UUID        REFERENCES users(id) ON DELETE SET NULL,
  result                TEXT        NOT NULL CHECK (result IN ('verified','flagged')),
  expected_location_id  UUID        REFERENCES locations(id) ON DELETE SET NULL,
  actual_location_id    UUID        REFERENCES locations(id) ON DELETE SET NULL,
  expected_assignee_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  actual_assignee_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  flag_reason           TEXT,
  notes                 TEXT,
  geo_lat               NUMERIC(9,6),
  geo_lng               NUMERIC(9,6),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_verifications_unique UNIQUE (cycle_id, asset_id)
);
CREATE INDEX IF NOT EXISTS audit_verifications_cycle_idx ON audit_verifications(cycle_id);

-- ---------- asset_photos ----------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_photos (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id        UUID        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url             TEXT,
  storage_path    TEXT        NOT NULL,
  mime_type       TEXT        NOT NULL,
  size_bytes      BIGINT,
  uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  caption         TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS asset_photos_asset_idx ON asset_photos(asset_id, status);
