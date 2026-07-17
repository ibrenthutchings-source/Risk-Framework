import { randomUUID } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { withTenant } from "../middleware/tenantContext";
import { workpaperQueue } from "../worker/queues";

export const workpapersRouter = Router();
workpapersRouter.use(requireAuth);

const exportBody = z.object({
  sections: z.array(z.string()).min(1),
  format: z.enum(["pdf", "xlsx", "docx"]),
});

workpapersRouter.post(
  "/v1/engagements/:id/workpapers",
  withTenant(async (req, res, client) => {
    const engagement = await client.query<{ firm_id: string }>(`SELECT firm_id FROM engagements WHERE id = $1`, [req.params.id]);
    if (!engagement.rowCount) return res.status(404).json({ error: "engagement not found" });

    const body = exportBody.parse(req.body);
    const jobId = randomUUID();
    const firmId = engagement.rows[0].firm_id;

    await client.query(
      `INSERT INTO workpaper_jobs (id, firm_id, engagement_id, sections, format, status)
       VALUES ($1,$2,$3,$4,$5,'queued')`,
      [jobId, firmId, req.params.id, body.sections, body.format]
    );

    // api and worker are separate Railway services/processes — job status
    // lives in workpaper_jobs (above), not in memory, so either side can
    // read/update it regardless of which replica handles the request.
    await workpaperQueue.add("generate", {
      jobId,
      firmId,
      engagementId: req.params.id,
      sections: body.sections,
      format: body.format,
    });

    res.status(202).json({ job_id: jobId, status: "queued" });
  })
);

workpapersRouter.get(
  "/v1/workpapers/:job_id",
  withTenant(async (req, res, client) => {
    const rows = await client.query(
      `SELECT status, download_url, error FROM workpaper_jobs WHERE id = $1`,
      [req.params.job_id]
    );
    if (!rows.rowCount) return res.status(404).json({ error: "not found" });
    const job = rows.rows[0];
    res.json({ status: job.status, download_url: job.download_url, error: job.error });
  })
);
