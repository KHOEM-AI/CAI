#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# CAI Pro Vision — Database layer setup (pool.ts, schema.sql, migrate.ts, .env.example)
# រត់ក្នុងថត root នៃ repo "CAI" (ថតដែលមាន backend/ រួចហើយ)
#   cd ~/CAI-new
#   bash setup-cai-db.sh
# ============================================================
set -e

mkdir -p backend/db

echo "📝 កំពុងសរសេរ backend/db/pool.ts ..."
cat > backend/db/pool.ts << 'CAIEOF'
import { Pool } from 'pg';
import 'dotenv/config';

// ត្រូវកំណត់ DATABASE_URL ក្នុង .env — ឧ.
// DATABASE_URL=postgres://user:password@localhost:5432/cai
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client', err);
});
CAIEOF
echo "  ✅ backend/db/pool.ts"

echo "📝 កំពុងសរសេរ backend/db/schema.sql ..."
cat > backend/db/schema.sql << 'CAIEOF'
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
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON refresh_tokens (user_id, token_hash)
  WHERE revoked_at IS NULL;

-- ------------------------------------------------------------
-- TABLE: audit_log  (append-only — គ្មាន UPDATE/DELETE ធម្មតា)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  metadata      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id   ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

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
-- ❌ NOT YET INCLUDED (Phase 2-4): scans, scan_items, scan_verifications, sync_queue
-- ============================================================
CAIEOF
echo "  ✅ backend/db/schema.sql"

echo "📝 កំពុងសរសេរ backend/db/migrate.ts ..."
cat > backend/db/migrate.ts << 'CAIEOF'
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import 'dotenv/config';

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemaPath = join(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');

  console.log(`[migrate] applying ${schemaPath} ...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[migrate] ✅ schema applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] ❌ failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
CAIEOF
echo "  ✅ backend/db/migrate.ts"

echo "📝 កំពុងសរសេរ backend/.env.example ..."
cat > backend/.env.example << 'CAIEOF'
# ============================================================
# CAI Pro Vision — Backend environment variables
# ចម្លងឯកសារនេះទៅ .env រួចដាក់តម្លៃពិត — កុំ commit .env ចូល git ជាដាច់ខាត
#   cp .env.example .env
# ============================================================

# --- Server ---
PORT=4000
CORS_ORIGIN=http://localhost:5173

# --- Database ---
DATABASE_URL=postgres://cai_app_user:changeme@localhost:5432/cai

# --- JWT Secrets ---
# បង្កើតដោយ command: openssl rand -hex 32
JWT_ACCESS_SECRET=REPLACE_WITH_OPENSSL_RAND_HEX_32
JWT_REFRESH_SECRET=REPLACE_WITH_A_DIFFERENT_OPENSSL_RAND_HEX_32

JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CAIEOF
echo "  ✅ backend/.env.example"

echo ""
echo "🎉 ចប់! ឯកសារទាំង 4 ត្រូវបានសរសេរផ្ទាល់ក្នុងថត backend/db/ និង backend/"
echo ""
ls -la backend/db/ backend/.env.example
echo ""
echo "📋 ជំហានបន្ទាប់៖"
echo "  cd backend"
echo "  cp .env.example .env"
echo "  # កែ .env ដាក់ DATABASE_URL ពិត + JWT secrets (openssl rand -hex 32)"
echo "  npm run migrate   # (ត្រូវមាន script 'migrate': 'tsx db/migrate.ts' ក្នុង package.json)"
