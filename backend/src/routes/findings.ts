import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { withTenant, resolveEngagementRole } from "../middleware/tenantContext";
import { appendAuditEvent } from "../auditTrail";

export const findingsRouter = Router();
findingsRouter.use(requireAuth);

const patchFindingBody = z.object({
  status: z.enum(["open", "monitoring", "escalated", "resolved"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
});

// Status/severity transitions only — findings are never hard-deleted.
findingsRouter.patch(
  "/v1/findings/:id",
  withTenant(async (req, res, client) => {
    const body = patchFindingBody.parse(req.body);
    if (!body.status && !body.severity) {
      return res.status(400).json({ error: "nothing to update" });
    }

    const existing = await client.query<{ engagement_id: string; firm_id: string }>(
      `SELECT engagement_id, firm_id FROM findings WHERE id = $1`,
      [req.params.id]
    );
    if (!existing.rowCount) return res.status(404).json({ error: "not found" });
    const { engagement_id: engagementId, firm_id: firmId } = existing.rows[0];

    const role = await resolveEngagementRole(client, req.tenant!, engagementId);
    if (role === "client_viewer") return res.status(403).json({ error: "read-only role" });

    const updated = await client.query(
      `UPDATE findings SET
         status = COALESCE($2, status),
         severity = COALESCE($3, severity)
       WHERE id = $1
       RETURNING *`,
      [req.params.id, body.status ?? null, body.severity ?? null]
    );

    await appendAuditEvent(client, {
      engagementId,
      firmId,
      actorId: req.tenant!.userId,
      action: body.status ? `Finding status → ${body.status}` : `Finding severity → ${body.severity}`,
      targetType: "finding",
      targetId: req.params.id,
      status: body.status ?? updated.rows[0].status,
    });

    res.json({ data: updated.rows[0] });
  })
);

findingsRouter.get(
  "/v1/findings/:id/evidence",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM evidence WHERE finding_id = $1`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

const createEvidenceBody = z.object({
  type: z.enum(["tx", "contract", "flow", "document"]),
  ref: z.string(),
  block_number: z.number().int().optional(),
  description: z.string().optional(),
  verified: z.boolean().default(false),
});

findingsRouter.post(
  "/v1/findings/:id/evidence",
  withTenant(async (req, res, client) => {
    const finding = await client.query<{ engagement_id: string; firm_id: string }>(
      `SELECT engagement_id, firm_id FROM findings WHERE id = $1`,
      [req.params.id]
    );
    if (!finding.rowCount) return res.status(404).json({ error: "not found" });

    const role = await resolveEngagementRole(client, req.tenant!, finding.rows[0].engagement_id);
    if (role === "client_viewer") return res.status(403).json({ error: "read-only role" });

    const body = createEvidenceBody.parse(req.body);
    const inserted = await client.query(
      `INSERT INTO evidence (finding_id, firm_id, type, ref, block_number, description, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, finding.rows[0].firm_id, body.type, body.ref, body.block_number ?? null, body.description ?? null, body.verified]
    );
    res.status(201).json({ data: inserted.rows[0] });
  })
);
