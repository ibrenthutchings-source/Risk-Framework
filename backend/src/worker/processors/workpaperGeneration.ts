import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Job } from "bullmq";
import { config } from "../../config";
import { withTenantTransaction } from "../../db";
import { WorkpaperJob } from "../queues";

const SECTION_QUERIES: Record<string, { table: string; label: string }> = {
  findings: { table: "findings", label: "Findings & Risk Register" },
  tokens: { table: "token_holdings", label: "Token Existence & Ownership" },
  contracts: { table: "contract_profiles", label: "Smart Contract Behavior" },
  governance: { table: "governance_actions", label: "Governance Activity" },
  tokenomics: { table: "tokenomics_events", label: "Tokenomics → Financial Bridge" },
  infra: { table: "validators", label: "Validators & Custody" },
  trail: { table: "audit_trail", label: "Audit Trail & Sign-offs" },
};

const s3 = config.storage.bucket
  ? new S3Client({
      region: "auto",
      endpoint: config.storage.endpoint || undefined,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    })
  : null;

/**
 * Assembles the requested sections into a JSON workpaper and uploads it to
 * object storage. Real PDF/XLSX rendering is a follow-up — this proves the
 * job → DB status → storage → signed URL pipeline end to end with a format
 * that's trivial to generate correctly.
 */
export async function processWorkpaperGeneration(job: Job<WorkpaperJob>): Promise<void> {
  const { jobId, firmId, engagementId, sections, format } = job.data;

  await setStatus(firmId, jobId, "generating");

  try {
    const content: Record<string, unknown> = {};
    await withTenantTransaction(firmId, async (client) => {
      const engagement = await client.query(`SELECT * FROM engagements WHERE id = $1`, [engagementId]);
      content.engagement = engagement.rows[0];

      for (const section of sections) {
        const spec = SECTION_QUERIES[section];
        if (!spec) continue;
        const rows = await client.query(`SELECT * FROM ${spec.table} WHERE engagement_id = $1`, [engagementId]);
        content[section] = { label: spec.label, rows: rows.rows };
      }
    });

    const key = `workpapers/${firmId}/${jobId}.json`;
    const body = Buffer.from(JSON.stringify({ format, generated_at: new Date().toISOString(), content }, null, 2));

    if (!s3) {
      throw new Error("object storage not configured (S3_BUCKET missing)");
    }
    await s3.send(new PutObjectCommand({ Bucket: config.storage.bucket, Key: key, Body: body, ContentType: "application/json" }));

    // A production version would generate a short-lived signed GET URL
    // instead of a bare key/path — left as a follow-up alongside real
    // PDF/XLSX rendering.
    await setStatus(firmId, jobId, "complete", `${config.storage.endpoint}/${config.storage.bucket}/${key}`);
  } catch (err) {
    await setStatus(firmId, jobId, "error", null, (err as Error).message);
    throw err;
  }
}

async function setStatus(firmId: string, jobId: string, status: string, downloadUrl?: string | null, error?: string) {
  await withTenantTransaction(firmId, (client) =>
    client.query(
      `UPDATE workpaper_jobs SET status = $2, download_url = $3, error = $4, updated_at = now() WHERE id = $1`,
      [jobId, status, downloadUrl ?? null, error ?? null]
    )
  );
}
