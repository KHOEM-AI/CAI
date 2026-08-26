import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { authenticate, requireRole } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// មើលបញ្ជីអ្នកប្រើ — admin ឡើងទៅ
router.get('/', authenticate, requireRole('admin'), async (_req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: result.rows });
});

const roleChangeSchema = z.object({
  role: z.enum(['staff', 'admin', 'super_admin']),
});

// ប្តូរ role — មានតែ super_admin ប៉ុណ្ណោះទើបអាចលើក admin/super_admin
// admin ធម្មតាអាចប្តូរបានតែ staff ↔ staff (i.e. គ្មានសិទ្ធិលើកគ្នាឯង)
router.patch('/:id/role', authenticate, requireRole('admin'), async (req, res) => {
  const parsed = roleChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { role: newRole } = parsed.data;
  const targetId = req.params.id;

  if ((newRole === 'admin' || newRole === 'super_admin') && req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: 'មានតែ super_admin ទើបលើកអ្នកណាម្នាក់ជា admin/super_admin បាន' });
  }

  const current = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetId]);
  if (!current.rowCount) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });

  const updated = await pool.query(
    'UPDATE users SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, name, email, role',
    [newRole, targetId]
  );

  await recordAudit({
    actorId: req.user!.sub,
    action: 'user.role_changed',
    targetType: 'user',
    targetId,
    metadata: { from: current.rows[0].role, to: newRole },
    ipAddress: req.ip,
  });

  res.json({ user: updated.rows[0] });
});

// ផ្អាក/បើកគណនី — admin ឡើងទៅ, ជានិច្ចត្រូវ audit
router.patch('/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  const schema = z.object({ status: z.enum(['active', 'suspended']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await pool.query(
    'UPDATE users SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, name, status',
    [parsed.data.status, req.params.id]
  );
  if (!updated.rowCount) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });

  await recordAudit({
    actorId: req.user!.sub,
    action: 'user.status_changed',
    targetType: 'user',
    targetId: req.params.id,
    metadata: { status: parsed.data.status },
    ipAddress: req.ip,
  });

  res.json({ user: updated.rows[0] });
});

export default router;
