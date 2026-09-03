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
