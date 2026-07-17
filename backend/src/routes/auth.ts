import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { withTenantTransaction } from "../db";

export const authRouter = Router();

const switchFirmBody = z.object({ firm_id: z.string().uuid() });

/**
 * Reissues a token scoped to a different firm the caller holds an active
 * membership in. A token carries exactly one firm_id — this is how a
 * multi-firm user moves between them, not by widening one token's scope.
 *
 * This is a legitimate cross-tenant lookup (the caller doesn't have the
 * target firm's context yet), so it scopes app.firm_id to the *target*
 * firm for the membership check rather than going through withTenant(),
 * which would scope to the token's current (source) firm.
 */
authRouter.post("/auth/switch-firm", requireAuth, async (req, res, next) => {
  try {
    const body = switchFirmBody.parse(req.body);
    const tenant = req.tenant!;

    const membership = await withTenantTransaction(body.firm_id, (client) =>
      client.query<{ role: string; status: string }>(
        `SELECT role, status FROM firm_memberships WHERE firm_id = $1 AND user_id = $2 LIMIT 1`,
        [body.firm_id, tenant.userId]
      )
    );

    if (!membership.rowCount || membership.rows[0].status !== "active") {
      return res.status(403).json({ error: "no active membership in that firm" });
    }

    const token = jwt.sign(
      { user_id: tenant.userId, firm_id: body.firm_id, role: membership.rows[0].role },
      config.jwtSecret,
      { expiresIn: "12h" }
    );
    res.json({ token });
  } catch (err) {
    next(err);
  }
});
