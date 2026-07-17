import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { withTenant, resolveEngagementRole } from "../middleware/tenantContext";
import { appendAuditEvent } from "../auditTrail";

export const signoffsRouter = Router();
signoffsRouter.use(requireAuth);

const decisionBody = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().optional(),
});

// Restricted to partner/lead role — per-engagement override still wins if present.
signoffsRouter.post(
  "/sign-offs/:id/decision",
  withTenant(async (req, res, client) => {
    const existing = await client.query<{ engagement_id: string; firm_id: string }>(
      `SELECT engagement_id, firm_id FROM sign_offs WHERE id = $1`,
      [req.params.id]
    );
    if (!existing.rowCount) return res.status(404).json({ error: "not found" });
    const { engagement_id: engagementId, firm_id: firmId } = existing.rows[0];

    const role = await resolveEngagementRole(client, req.tenant!, engagementId);
    if (role !== "partner" && role !== "lead_auditor") {
      return res.status(403).json({ error: "requires partner or lead_auditor role on this engagement" });
    }

    const body = decisionBody.parse(req.body);
    const updated = await client.query(
      `UPDATE sign_offs SET status = $2, note = $3, reviewer_id = $4, decided_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, body.status, body.note ?? null, req.tenant!.userId]
    );

    await appendAuditEvent(client, {
      engagementId,
      firmId,
      actorId: req.tenant!.userId,
      action: `Sign-off ${body.status}`,
      targetType: "sign_off",
      targetId: req.params.id,
      status: body.status,
    });

    res.json({ data: updated.rows[0] });
  })
);
