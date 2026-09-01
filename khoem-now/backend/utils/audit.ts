import { pool } from '../db/pool';

export async function recordAudit(params: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  const { actorId, action, targetType, targetId, metadata, ipAddress } = params;
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, action, targetType ?? null, targetId ?? null, metadata ? JSON.stringify(metadata) : null, ipAddress ?? null]
    );
  } catch (err) {
    // Audit logging must never crash the request — log locally and move on
    console.error('[audit] failed to record', action, err);
  }
}
