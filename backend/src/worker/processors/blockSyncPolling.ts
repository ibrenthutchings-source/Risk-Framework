import { Job } from "bullmq";
import { config } from "../../config";
import { pool, withTenantTransaction } from "../../db";
import { publishFeedEvent } from "../../realtime";

// Cap RPC calls per tick (one eth_getBlockByNumber call per block) so a
// large gap since the last tick — a slow poller, a worker restart — can't
// turn into an unbounded catch-up burst. The remainder is picked up on
// subsequent ticks.
const MAX_BLOCKS_PER_TICK = 25;

interface TrackedWallet {
  id: string;
  firmId: string;
  engagementId: string;
  address: string; // lowercased
}

interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
}

/**
 * Runs on a schedule. Walks new blocks on the single configured chain
 * (RPC_PROVIDER_URL / RPC_CHAIN — this backend doesn't multiplex RPC
 * endpoints per chain yet), matches transactions against every firm's
 * tracked wallets_contracts rows, and writes+publishes a feed_events row
 * for each match. GET /v1/engagements/:id/feed/stream relays those
 * publishes as SSE.
 */
export async function processBlockSyncPolling(_job: Job): Promise<void> {
  if (!config.rpc.url || !config.rpc.chain) {
    console.warn("block-sync-polling: RPC_PROVIDER_URL/RPC_CHAIN not configured, skipping");
    return;
  }

  const latestBlock = await getLatestBlockNumber();
  const cursor = await getSyncCursor(config.rpc.chain);

  if (cursor === null) {
    // Cold start: establish a baseline at the chain tip instead of
    // backfilling the entire chain history through eth_getBlockByNumber.
    await setSyncCursor(config.rpc.chain, latestBlock);
    return;
  }

  const fromBlock = cursor + 1;
  if (fromBlock > latestBlock) return;
  const toBlock = Math.min(latestBlock, fromBlock + MAX_BLOCKS_PER_TICK - 1);

  const wallets = await loadTrackedWallets(config.rpc.chain);
  if (wallets.length === 0) {
    await setSyncCursor(config.rpc.chain, toBlock);
    return;
  }
  const byAddress = new Map<string, TrackedWallet[]>();
  for (const w of wallets) {
    const list = byAddress.get(w.address) ?? [];
    list.push(w);
    byAddress.set(w.address, list);
  }

  for (let bn = fromBlock; bn <= toBlock; bn++) {
    const block = await getBlockByNumber(bn);
    if (!block?.transactions) continue;

    for (const tx of block.transactions) {
      const from = (tx.from || "").toLowerCase();
      const to = (tx.to || "").toLowerCase();
      const valueWei = BigInt(tx.value || "0x0").toString();

      const fromWallets = from ? byAddress.get(from) : undefined;
      if (fromWallets) {
        for (const w of fromWallets) {
          await recordEvent(w, { blockNumber: bn, txHash: tx.hash, from, to: to || null, valueWei, direction: "out" });
        }
      }
      const toWallets = to ? byAddress.get(to) : undefined;
      if (toWallets) {
        for (const w of toWallets) {
          await recordEvent(w, { blockNumber: bn, txHash: tx.hash, from, to: to || null, valueWei, direction: "in" });
        }
      }
    }
  }

  await setSyncCursor(config.rpc.chain, toBlock);
}

async function recordEvent(
  wallet: TrackedWallet,
  ev: { blockNumber: number; txHash: string; from: string; to: string | null; valueWei: string; direction: "in" | "out" }
): Promise<void> {
  await withTenantTransaction(wallet.firmId, async (client) => {
    const counterparty = ev.direction === "out" ? ev.to : ev.from;
    let isNewCounterparty = false;
    if (counterparty) {
      const seen = await client.query(
        `SELECT 1 FROM feed_events WHERE wallet_id = $1 AND (from_address = $2 OR to_address = $2) LIMIT 1`,
        [wallet.id, counterparty]
      );
      isNewCounterparty = seen.rowCount === 0;
    }
    const severity = severityFor(ev.valueWei, isNewCounterparty);

    const inserted = await client.query(
      `INSERT INTO feed_events
         (firm_id, engagement_id, wallet_id, chain, block_number, tx_hash, from_address, to_address, value_wei, direction, is_new_counterparty, severity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (wallet_id, tx_hash, direction) DO NOTHING
       RETURNING *`,
      [
        wallet.firmId, wallet.engagementId, wallet.id, config.rpc.chain, ev.blockNumber, ev.txHash,
        ev.from, ev.to, ev.valueWei, ev.direction, isNewCounterparty, severity,
      ]
    );
    if (inserted.rowCount) {
      await publishFeedEvent(wallet.engagementId, inserted.rows[0]);
    }
  });
}

// Naive value-based heuristic — real anomaly scoring (behavioral baselines,
// counterparty risk intel) is out of scope here; this is honest threshold
// logic over real on-chain values, not fabricated severity.
function severityFor(valueWei: string, isNewCounterparty: boolean): "critical" | "high" | "medium" | "low" | "info" {
  const ether = Number(BigInt(valueWei) / 10n ** 14n) / 10_000;
  let severity: "critical" | "high" | "medium" | "low" | "info";
  if (ether >= 1000) severity = "critical";
  else if (ether >= 100) severity = "high";
  else if (ether >= 10) severity = "medium";
  else if (ether >= 1) severity = "low";
  else severity = "info";
  if (isNewCounterparty && severity === "info") return "low";
  return severity;
}

async function loadTrackedWallets(chain: string): Promise<TrackedWallet[]> {
  const firms = await pool.query<{ id: string }>(`SELECT id FROM firms`);
  const out: TrackedWallet[] = [];
  for (const firm of firms.rows) {
    await withTenantTransaction(firm.id, async (client) => {
      const rows = await client.query<{ id: string; engagement_id: string; address: string }>(
        `SELECT id, engagement_id, address FROM wallets_contracts WHERE chain = $1`,
        [chain]
      );
      for (const r of rows.rows) {
        out.push({ id: r.id, firmId: firm.id, engagementId: r.engagement_id, address: r.address.toLowerCase() });
      }
    });
  }
  return out;
}

async function getSyncCursor(chain: string): Promise<number | null> {
  const res = await pool.query<{ last_block: string }>(`SELECT last_block FROM chain_sync_state WHERE chain = $1`, [chain]);
  return res.rowCount ? Number(res.rows[0].last_block) : null;
}

async function setSyncCursor(chain: string, block: number): Promise<void> {
  await pool.query(
    `INSERT INTO chain_sync_state (chain, last_block) VALUES ($1, $2)
     ON CONFLICT (chain) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = now()`,
    [chain, block]
  );
}

async function getLatestBlockNumber(): Promise<number> {
  const body = await rpcCall("eth_blockNumber", []);
  return parseInt(body.result, 16);
}

async function getBlockByNumber(blockNumber: number): Promise<{ transactions: RpcTx[] } | null> {
  const body = await rpcCall("eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, true]);
  return body.result ?? null;
}

async function rpcCall(method: string, params: unknown[]): Promise<{ result: any }> {
  const res = await fetch(config.rpc.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC call ${method} failed: ${res.status}`);
  return (await res.json()) as { result: any };
}
