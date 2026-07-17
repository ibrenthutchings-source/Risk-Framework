import { Job } from "bullmq";
import { pool, withTenantTransaction } from "../../db";

/**
 * Runs on a schedule (see worker/index.ts repeatable job). Cross-tenant by
 * nature — "evaluate every firm's rules" — so it loops firm-by-firm and
 * scopes each pass with withTenantTransaction rather than using any kind
 * of RLS-bypass connection. Condition evaluation itself (matching rule
 * conditions against live feed events) depends on the block-sync feed,
 * which is a structural stub — this wires the tenant-safe iteration
 * pattern real processors would build on.
 */
export async function processAlertRuleEvaluation(_job: Job): Promise<void> {
  const firms = await pool.query<{ id: string }>(`SELECT id FROM firms`);

  for (const firm of firms.rows) {
    await withTenantTransaction(firm.id, async (client) => {
      const rules = await client.query(
        `SELECT ar.id, ar.engagement_id, ar.condition, ar.threshold, ar.severity, ar.channel
         FROM alert_rules ar
         WHERE ar.enabled = true`
      );

      for (const rule of rules.rows) {
        // TODO: evaluate `rule.condition` against recent feed events once
        // block-sync-polling is populating a tx/event table to query against.
        void rule;
      }
    });
  }
}
