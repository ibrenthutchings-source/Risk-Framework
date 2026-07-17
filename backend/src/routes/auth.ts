import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { pool, withTenantTransaction } from "../db";

export const authRouter = Router();

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
  // Selects which firm's context to issue the token for, when the user
  // belongs to more than one. Optional — defaults to the first active
  // membership found. (POST /v1/auth/switch-firm handles moving to a
  // different one afterward.)
  firm_id: z.string().uuid().optional(),
});

/**
 * The only way to get a *first* token — everything else (switch-firm,
 * every tenant route) assumes you already have one. Looks up the user
 * globally (users has no firm_id — see §1), verifies the password, then
 * resolves which firm's role to embed in the token via firm_memberships.
 *
 * There's deliberately no self-service signup here: real firm onboarding
 * is an invite flow (firm_memberships.invited_by), not an open POST. This
 * endpoint only issues tokens for users that already exist — created via
 * the seed script for now (scripts/seed-user.js) until an invite flow
 * exists.
 */
authRouter.post("/auth/login", async (req, res, next) => {
  try {
    const body = loginBody.parse(req.body);

    const user = await pool.query<{ id: string; password_hash: string | null }>(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [body.email]
    );
    if (!user.rowCount || !user.rows[0].password_hash) {
      return res.status(401).json({ error: "invalid email or password" });
    }
    const ok = await bcrypt.compare(body.password, user.rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid email or password" });
    }
    const userId = user.rows[0].id;

    const membership = await pool.query<{ firm_id: string; role: string }>(
      `SELECT firm_id, role FROM firm_memberships
       WHERE user_id = $1 AND status = 'active' ${body.firm_id ? "AND firm_id = $2" : ""}
       ORDER BY joined_at NULLS LAST
       LIMIT 1`,
      body.firm_id ? [userId, body.firm_id] : [userId]
    );
    if (!membership.rowCount) {
      return res.status(403).json({ error: "no active firm membership" });
    }

    const token = jwt.sign(
      { user_id: userId, firm_id: membership.rows[0].firm_id, role: membership.rows[0].role },
      config.jwtSecret,
      { expiresIn: "12h" }
    );
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

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
