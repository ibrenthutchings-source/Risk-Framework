import { randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { withTenant } from "../middleware/tenantContext";
import { duneExecutionQueue } from "../worker/queues";

export const queriesRouter = Router();
queriesRouter.use(requireAuth);

queriesRouter.get(
  "/v1/queries",
  withTenant(async (_req, res, client) => {
    const rows = await client.query(`SELECT * FROM query_library ORDER BY name`);
    res.json({ data: rows.rows });
  })
);

const executeBody = z.object({
  params: z.record(z.unknown()).default({}),
  engagement_id: z.string().uuid().optional(),
});

// Server-side proxy to Dune — the API key lives only in worker env vars,
// never in this response or in any client bundle.
queriesRouter.post(
  "/v1/queries/:id/execute",
  withTenant(async (req, res, client) => {
    const query = await client.query<{ id: string; firm_id: string }>(
      `SELECT id, firm_id FROM query_library WHERE id = $1`,
      [req.params.id]
    );
    if (!query.rowCount) return res.status(404).json({ error: "not found" });

    const body = executeBody.parse(req.body);
    const executionId = randomUUID();

    await client.query(
      `INSERT INTO query_executions (id, query_id, engagement_id, firm_id, status, started_at)
       VALUES ($1,$2,$3,$4,'queued', now())`,
      [executionId, req.params.id, body.engagement_id ?? null, query.rows[0].firm_id]
    );

    await duneExecutionQueue.add("execute", {
      executionId,
      queryId: req.params.id,
      firmId: query.rows[0].firm_id,
      engagementId: body.engagement_id ?? null,
      params: body.params,
    });

    res.status(202).json({ execution_id: executionId, status: "queued" });
  })
);

// Cached 15 min per query+params in production — this reads straight
// through to query_executions; caching is a worker/infra concern, not
// modeled in this route.
queriesRouter.get(
  "/v1/executions/:execution_id",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM query_executions WHERE id = $1`, [req.params.execution_id]);
    if (!rows.rowCount) return res.status(404).json({ error: "not found" });
    res.json({ data: rows.rows[0] });
  })
);
