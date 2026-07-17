import { Job } from "bullmq";
import { config } from "../../config";
import { pool, withTenantTransaction } from "../../db";

/**
 * Runs on a schedule. Structural stub: confirms RPC connectivity and walks
 * every firm's in-scope wallets/contracts — this is where tx ingestion,
 * entity resolution, and anomaly scoring (the frontend's live-feed mock)
 * would plug in. Not built here; that's a distinct RPC-subscription
 * project, not a schema/multi-tenancy concern.
 */
export async function processBlockSyncPolling(_job: Job): Promise<void> {
  if (!config.rpc.url) {
    console.warn("block-sync-polling: RPC_PROVIDER_URL not configured, skipping");
    return;
  }

  const latestBlock = await getLatestBlockNumber();

  const firms = await pool.query<{ id: string }>(`SELECT id FROM firms`);
  for (const firm of firms.rows) {
    await withTenantTransaction(firm.id, async (client) => {
      const wallets = await client.query(`SELECT id, address, chain FROM wallets_contracts`);
      // TODO: for each wallet, fetch new transactions since the last synced
      // block, tag counterparties, score anomalies, and persist to a feed
      // table + push to any open SSE connections for that engagement.
      void wallets;
    });
  }

  void latestBlock;
}

async function getLatestBlockNumber(): Promise<number> {
  const res = await fetch(config.rpc.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  if (!res.ok) throw new Error(`RPC call failed: ${res.status}`);
  const body = (await res.json()) as { result: string };
  return parseInt(body.result, 16);
}
