import { Job } from "bullmq";
import { config } from "../../config";
import { withTenantTransaction } from "../../db";
import { DuneExecutionJob } from "../queues";

const DUNE_BASE = "https://api.dune.com/api/v1";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~1 minute ceiling; long-running queries fall through to "executing" and get picked up by a future poll job in a fuller implementation.

/**
 * Server-side proxy to Dune. DUNE_API_KEY is read from this process's env
 * only — it is never included in any API response or client bundle (the
 * prototype hardcoded one client-side; this replaces that).
 */
export async function processDuneExecution(job: Job<DuneExecutionJob>): Promise<void> {
  const { executionId, queryId, firmId, params } = job.data;

  if (!config.dune.apiKey) {
    await markExecution(firmId, executionId, { status: "error" });
    throw new Error("DUNE_API_KEY not configured");
  }

  await markExecution(firmId, executionId, { status: "executing" });

  try {
    const startRes = await fetch(`${DUNE_BASE}/query/${queryId}/execute`, {
      method: "POST",
      headers: { "X-Dune-API-Key": config.dune.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query_parameters: params }),
    });
    if (!startRes.ok) throw new Error(`Dune execute failed: ${startRes.status}`);
    const { execution_id: duneExecutionId } = (await startRes.json()) as { execution_id: string };

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      const statusRes = await fetch(`${DUNE_BASE}/execution/${duneExecutionId}/status`, {
        headers: { "X-Dune-API-Key": config.dune.apiKey },
      });
      if (!statusRes.ok) throw new Error(`Dune status check failed: ${statusRes.status}`);
      const status = (await statusRes.json()) as { state: string };

      if (status.state === "QUERY_STATE_COMPLETED") {
        const resultsRes = await fetch(`${DUNE_BASE}/execution/${duneExecutionId}/results`, {
          headers: { "X-Dune-API-Key": config.dune.apiKey },
        });
        if (!resultsRes.ok) throw new Error(`Dune results fetch failed: ${resultsRes.status}`);
        const results = (await resultsRes.json()) as {
          result?: { rows?: unknown[]; metadata?: { total_row_count?: number } };
        };

        await markExecution(firmId, executionId, {
          status: "completed",
          rows_scanned: results.result?.metadata?.total_row_count ?? null,
          result: results.result?.rows ?? [],
        });
        return;
      }
      if (status.state === "QUERY_STATE_FAILED") {
        throw new Error("Dune query execution failed");
      }
      // else still QUERY_STATE_PENDING / EXECUTING — keep polling.
    }

    // Exceeded poll budget without completion — leave as "executing" rather
    // than mark done or failed; a production version would re-enqueue a
    // follow-up poll job instead of holding this worker slot open longer.
  } catch (err) {
    await markExecution(firmId, executionId, { status: "error" });
    throw err;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markExecution(
  firmId: string,
  executionId: string,
  fields: { status: string; rows_scanned?: number | null; result?: unknown }
) {
  await withTenantTransaction(firmId, (client) =>
    client.query(
      `UPDATE query_executions SET
         status = $2,
         rows_scanned = COALESCE($3, rows_scanned),
         result = COALESCE($4, result),
         ended_at = CASE WHEN $2 IN ('completed','error') THEN now() ELSE ended_at END
       WHERE id = $1`,
      [executionId, fields.status, fields.rows_scanned ?? null, fields.result ? JSON.stringify(fields.result) : null]
    )
  );
}
