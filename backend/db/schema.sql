-- ============================================================
-- CAI Pro Vision — Database Schema (Phase 1: Auth + RBAC + Audit)
-- ត្រូវនឹង docs/DATABASE.md — តែងតែប្រើ IF NOT EXISTS ដើម្បីអាចរត់ម្តងទៀតដោយសុវត្ថិភាព
-- (idempotent migration — រត់ច្រើនដងមិនបញ្ហា)
-- ============================================================

-- UUID generator (pgcrypto) — ប្រើ gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('staff', 'admin', 'super_admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- TABLE: users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           user_role NOT NULL DEFAULT 'staff',   -- ⚠️ server/DB កំណត់តែម្តង, client មិនកំណត់បាន
  status         user_status NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ------------------------------------------------------------
-- TABLE: refresh_tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,          -- SHA-256 នៃ token ពិត — មិនផ្ទុក token ត្រង់ៗ
  device_id    TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
-- ស្វែងរក token សុពលភាពលឿន (user_id + token_hash + not revoked + not expired)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON refresh_tokens (user_id, token_hash)
  WHERE revoked_at IS NULL;

-- ------------------------------------------------------------
-- TABLE: audit_log  (append-only — គ្មាន UPDATE/DELETE ធម្មតា)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,               -- e.g. 'auth.login', 'user.role_changed'
  target_type   TEXT,
  target_id     TEXT,
  metadata      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id   ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

-- ⚠️ Production TODO (មើល docs/SECURITY.md): បង្កើត DB role ដាច់ដោយឡែកសម្រាប់ app user
-- ដែលមិនមាន UPDATE/DELETE privilege លើ audit_log ដើម្បី enforce append-only នៅកម្រិត DB ពិត។
-- ឧទាហរណ៍ (រត់ម្តងជា superuser, កែ role name ឱ្យត្រូវនឹងអ្នកកំណត់ពិត)៖
--   REVOKE UPDATE, DELETE ON audit_log FROM cai_app_user;

-- ------------------------------------------------------------
-- updated_at auto-touch trigger សម្រាប់ users
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ❌ NOT YET INCLUDED (Phase 2-4 — មើល docs/DATABASE.md ផ្នែក "Tables ដែលមិនទាន់មាន"):
--   scans, scan_items, scan_verifications, sync_queue / sync_events
-- បន្ថែមជា migration ដាច់ដោយឡែក (schema_002_scans.sql ។ល។) ពេលចាប់ផ្តើម Phase 2។
-- ============================================================
