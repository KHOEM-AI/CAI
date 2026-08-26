import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db/pool';
import {
  hashPassword, verifyPassword,
  signAccessToken, signRefreshToken, verifyRefreshToken,
  hashToken,
} from '../utils/tokens';
import { recordAudit } from '../utils/audit';
import { authenticate } from '../middleware/auth';

const router = Router();

// P0 checklist item: rate limiting on auth endpoints
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ព្យាយាមចូលច្រើនដងពេក — សូមរង់ចាំមួយភ្លែត' },
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  // ⚠️ ចេតនាមិនទទួល `role` ពី client ទេ — សំណើ register ជា public ទាំងអស់ក្លាយជា 'staff'
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, email, password } = parsed.data;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount) return res.status(409).json({ error: 'អ៊ីមែលនេះបានប្រើរួចហើយ' });

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'staff', 'active')
     RETURNING id, name, email, role`,
    [name, email, passwordHash]
  );
  const user = result.rows[0];
  await recordAudit({ actorId: user.id, action: 'auth.register', targetType: 'user', targetId: user.id, ipAddress: req.ip });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, deviceId } = parsed.data;

  const result = await pool.query(
    'SELECT id, name, password_hash, role, status FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];

  // Generic error on both "no such user" and "wrong password" — avoid leaking which emails exist
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordAudit({ actorId: user?.id ?? null, action: 'auth.login_failed', metadata: { email }, ipAddress: req.ip });
    return res.status(401).json({ error: 'អ៊ីមែល ឬលេខសម្ងាត់មិនត្រឹមត្រូវ' });
  }
  if (user.status !== 'active') {
    await recordAudit({ actorId: user.id, action: 'auth.login_blocked_suspended', ipAddress: req.ip });
    return res.status(403).json({ error: 'គណនីនេះត្រូវបានផ្អាក — សូមទាក់ទងអ្នកគ្រប់គ្រង' });
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role, name: user.name });
  const refreshToken = signRefreshToken(user.id);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '7 days')`,
    [user.id, hashToken(refreshToken), deviceId ?? null]
  );

  await recordAudit({ actorId: user.id, action: 'auth.login', metadata: { deviceId }, ipAddress: req.ip });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, role: user.role },
  });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

  let decoded: { sub: string };
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await pool.query(
    `SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [decoded.sub, tokenHash]
  );
  if (!stored.rowCount) return res.status(401).json({ error: 'Refresh token revoked or not recognized' });

  const userResult = await pool.query('SELECT id, name, role, status FROM users WHERE id = $1', [decoded.sub]);
  const user = userResult.rows[0];
  if (!user || user.status !== 'active') return res.status(403).json({ error: 'Account not active' });

  const newAccessToken = signAccessToken({ sub: user.id, role: user.role, name: user.name });
  res.json({ accessToken: newAccessToken });
});

router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND token_hash = $2`,
      [req.user!.sub, hashToken(refreshToken)]
    );
  }
  await recordAudit({ actorId: req.user!.sub, action: 'auth.logout', ipAddress: req.ip });
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
