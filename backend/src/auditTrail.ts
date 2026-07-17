import { createHash } from "crypto";
import { PoolClient } from "pg";

const GENESIS_HASH = "0".repeat(64);

export interface AuditEventInput {
  engagementId: string;
  firmId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  status: string;
}

/**
 * Appends one row to the hash-chained, append-only audit_trail table.
 * Must run inside the same transaction as the change it's recording, and
 * locks the engagement's last row (FOR UPDATE) so concurrent writers can't
 * both read the same hash_prev and fork the chain.
 */
export async function appendAuditEvent(client: PoolClient, event: AuditEventInput): Promise<void> {
  const prev = await client.query<{ hash_self: string }>(
    `SELECT hash_self FROM audit_trail
     WHERE engagement_id = $1
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [event.engagementId]
  );
  const hashPrev = prev.rowCount ? prev.rows[0].hash_self : GENESIS_HASH;

  const canonical = JSON.stringify({
    engagement_id: event.engagementId,
    actor_id: event.actorId,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    status: event.status,
  });
  const hashSelf = createHash("sha256").update(hashPrev + canonical).digest("hex");

  await client.query(
    `INSERT INTO audit_trail (engagement_id, firm_id, actor_id, action, target_type, target_id, status, hash_prev, hash_self)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [event.engagementId, event.firmId, event.actorId, event.action, event.targetType, event.targetId, event.status, hashPrev, hashSelf]
  );
}

export interface VerifyResult {
  valid: boolean;
  brokenAt: number | null;
}

/** Recomputes the hash chain server-side; used by GET /v1/engagements/:id/audit-trail/verify. */
export async function verifyAuditChain(client: PoolClient, engagementId: string): Promise<VerifyResult> {
  const rows = await client.query<{
    id: number;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string;
    status: string;
    hash_prev: string;
    hash_self: string;
  }>(
    `SELECT id, actor_id, action, target_type, target_id, status, hash_prev, hash_self
     FROM audit_trail
     WHERE engagement_id = $1
     ORDER BY id ASC`,
    [engagementId]
  );

  let expectedPrev = GENESIS_HASH;
  for (const row of rows.rows) {
    if (row.hash_prev !== expectedPrev) {
      return { valid: false, brokenAt: row.id };
    }
    const canonical = JSON.stringify({
      engagement_id: engagementId,
      actor_id: row.actor_id,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      status: row.status,
    });
    const recomputed = createHash("sha256").update(row.hash_prev + canonical).digest("hex");
    if (recomputed !== row.hash_self) {
      return { valid: false, brokenAt: row.id };
    }
    expectedPrev = row.hash_self;
  }
  return { valid: true, brokenAt: null };
}
