import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import 'dotenv/config';

// រត់ដោយ: npm run migrate  (មើល package.json snippet ខាងក្រោម)
// អាន schema.sql ទាំងមូល ហើយប្រតិបត្តិម្តងតែមួយ — គ្រប់ statement ប្រើ IF NOT EXISTS
// ដូច្នេះអាចរត់ម្តងទៀត (idempotent) ដោយសុវត្ថិភាព។

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
