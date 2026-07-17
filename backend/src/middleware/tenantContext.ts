import { NextFunction, Request, Response } from "express";
import { PoolClient } from "pg";
import { withTenantTransaction } from "../db";
import { TenantContext } from "../types";

type TenantHandler = (req: Request, res: Response, client: PoolClient) => Promise<unknown>;

/**
 * Wraps a route handler in a transaction with app.firm_id set from the
 * verified token (requireAuth must run first). Every DB-touching route
 * should be written with this, not a raw pool.query — that's what keeps
 * RLS actually in the loop instead of an app-code afterthought.
 */
export function withTenant(handler: TenantHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) return res.status(401).json({ error: "unauthenticated" });
    try {
      await withTenantTransaction(req.tenant.firmId, (client) => handler(req, res, client));
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Firm role grants access to all the firm's engagements by default;
 * engagement_access narrows or extends that for one engagement, and its
 * role_override (when present) wins over the firm-wide role.
 */
export async function resolveEngagementRole(
  client: PoolClient,
  tenant: TenantContext,
  engagementId: string
): Promise<string | null> {
  const override = await client.query<{ role_override: string | null }>(
    `SELECT role_override FROM engagement_access
     WHERE engagement_id = $1 AND principal_type = 'user' AND principal_id = $2
     LIMIT 1`,
    [engagementId, tenant.userId]
  );
  if (override.rowCount && override.rows[0].role_override) {
    return override.rows[0].role_override;
  }
  // No override row, or an override row with role_override = null (inherit firm role).
  return tenant.role;
}
