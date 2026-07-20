import { Router } from "express";
import IORedis from "ioredis";
import { z } from "zod";
import { config } from "../config";
import { withTenantTransaction } from "../db";
import { requireAuth } from "../middleware/auth";
import { withTenant, resolveEngagementRole } from "../middleware/tenantContext";
import { appendAuditEvent, verifyAuditChain } from "../auditTrail";
import { feedChannel } from "../realtime";

export const engagementsRouter = Router();
engagementsRouter.use(requireAuth);

// ---------- GET /engagements ----------
// No firm_id query param — scope comes only from the token (RLS enforces
// it too, but keeping it out of the query surface avoids anyone building
// a client that tries to pass one).
engagementsRouter.get(
  "/engagements",
  withTenant(async (req, res, client) => {
    const fy = typeof req.query.fy === "string" ? req.query.fy : null;
    const rows = await client.query(
      `SELECT id, name, ticker, entity_type, fiscal_period, chains, coverage_pct, risk_score, created_at, updated_at
       FROM engagements
       WHERE ($1::text IS NULL OR fiscal_period = $1)
       ORDER BY created_at DESC`,
      [fy]
    );
    res.json({ data: rows.rows, page: { cursor: null, has_more: false } });
  })
);

// Not in the original §3 endpoint list (the doc only specs GET on
// /engagements) — added because without it there's no way to create the
// one entity everything else hangs off of. Restricted to partner/firm_admin
// since standing up a new engagement is an administrative action, not
// something a staff auditor does day-to-day.
const createEngagementBody = z.object({
  name: z.string().min(1),
  ticker: z.string().optional(),
  entity_type: z.enum(["defi_lending", "dao_treasury", "l2_infra", "other"]).optional(),
  fiscal_period: z.string().optional(),
  chains: z.array(z.string()).optional(),
});

engagementsRouter.post(
  "/engagements",
  withTenant(async (req, res, client) => {
    if (req.tenant!.role !== "partner" && req.tenant!.role !== "firm_admin") {
      return res.status(403).json({ error: "requires partner or firm_admin role" });
    }
    const body = createEngagementBody.parse(req.body);
    const inserted = await client.query(
      `INSERT INTO engagements (firm_id, name, ticker, entity_type, fiscal_period, chains)
       VALUES (current_setting('app.firm_id')::uuid, $1, $2, $3, $4, $5)
       RETURNING *`,
      [body.name, body.ticker ?? null, body.entity_type ?? null, body.fiscal_period ?? null, JSON.stringify(body.chains ?? [])]
    );
    res.status(201).json({ data: inserted.rows[0] });
  })
);

engagementsRouter.get(
  "/engagements/:id",
  withTenant(async (req, res, client) => {
    const result = await client.query(`SELECT * FROM engagements WHERE id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "not found" });
    res.json({ data: result.rows[0] });
  })
);

// ---------- Findings ----------
engagementsRouter.get(
  "/engagements/:id/findings",
  withTenant(async (req, res, client) => {
    const { status, severity, assertion, category } = req.query;
    const rows = await client.query(
      `SELECT * FROM findings
       WHERE engagement_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR severity = ANY(string_to_array($3, ',')))
         AND ($4::text IS NULL OR assertion = $4)
         AND ($5::text IS NULL OR category = $5)
       ORDER BY detected_at DESC`,
      [req.params.id, status ?? null, severity ?? null, assertion ?? null, category ?? null]
    );
    res.json({ data: rows.rows, page: { cursor: null, has_more: false } });
  })
);

const createFindingBody = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  assertion: z.enum([
    "existence", "completeness", "rights_obligations", "valuation", "presentation", "cutoff", "classification",
  ]),
  impact: z.number().int().min(1).max(5),
  likelihood: z.number().int().min(1).max(5),
  description: z.string().optional(),
  address_id: z.string().uuid().optional(),
  tx_hash: z.string().optional(),
});

function severityOf(impact: number, likelihood: number): string {
  const s = impact * likelihood;
  if (s >= 20) return "critical";
  if (s >= 12) return "high";
  if (s >= 6) return "medium";
  if (s >= 3) return "low";
  return "info";
}

engagementsRouter.post(
  "/engagements/:id/findings",
  withTenant(async (req, res, client) => {
    const engagementId = req.params.id;
    const role = await resolveEngagementRole(client, req.tenant!, engagementId);
    if (role === "client_viewer") return res.status(403).json({ error: "read-only role" });

    const body = createFindingBody.parse(req.body);
    const severity = severityOf(body.impact, body.likelihood);

    const firmRow = await client.query<{ firm_id: string }>(`SELECT firm_id FROM engagements WHERE id = $1`, [engagementId]);
    if (!firmRow.rowCount) return res.status(404).json({ error: "engagement not found" });
    const firmId = firmRow.rows[0].firm_id;

    const inserted = await client.query(
      `INSERT INTO findings (id, engagement_id, firm_id, title, category, assertion, impact, likelihood, severity, description, address_id, tx_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open')
       RETURNING *`,
      [body.id, engagementId, firmId, body.title, body.category ?? null, body.assertion, body.impact, body.likelihood, severity, body.description ?? null, body.address_id ?? null, body.tx_hash ?? null]
    );

    await appendAuditEvent(client, {
      engagementId,
      firmId,
      actorId: req.tenant!.userId,
      action: "Finding opened",
      targetType: "finding",
      targetId: body.id,
      status: "open",
    });

    res.status(201).json({ data: inserted.rows[0] });
  })
);

// ---------- Audit trail ----------
engagementsRouter.get(
  "/engagements/:id/audit-trail",
  withTenant(async (req, res, client) => {
    const { since, type, actor_id } = req.query;
    const rows = await client.query(
      `SELECT * FROM audit_trail
       WHERE engagement_id = $1
         AND ($2::bigint IS NULL OR id > $2::bigint)
         AND ($3::text IS NULL OR target_type = $3)
         AND ($4::uuid IS NULL OR actor_id = $4::uuid)
       ORDER BY id ASC
       LIMIT 200`,
      [req.params.id, since ?? null, type ?? null, actor_id ?? null]
    );
    const last = rows.rows[rows.rows.length - 1];
    res.json({ data: rows.rows, page: { cursor: last ? String(last.id) : null, has_more: rows.rows.length === 200 } });
  })
);

engagementsRouter.get(
  "/engagements/:id/audit-trail/verify",
  withTenant(async (req, res, client) => {
    const result = await verifyAuditChain(client, req.params.id);
    res.json(result);
  })
);

// ---------- Sign-offs ----------
engagementsRouter.get(
  "/engagements/:id/sign-offs",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM sign_offs WHERE engagement_id = $1 ORDER BY assertion`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

// ---------- Tokens / contracts / governance / tokenomics / validators ----------
engagementsRouter.get(
  "/engagements/:id/tokens",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM token_holdings WHERE engagement_id = $1`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

engagementsRouter.get(
  "/engagements/:id/contracts",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM contract_profiles WHERE engagement_id = $1`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

engagementsRouter.get(
  "/engagements/:id/governance",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM governance_actions WHERE engagement_id = $1 ORDER BY occurred_at DESC`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

engagementsRouter.get(
  "/engagements/:id/tokenomics",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM tokenomics_events WHERE engagement_id = $1`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

engagementsRouter.get(
  "/engagements/:id/validators",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM validators WHERE engagement_id = $1`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

// ---------- Wallets / contracts ----------
// Not in the original §3 endpoint list (only the derived /cross-chain
// rollup below was specced) — added because without a way to write
// wallets_contracts rows, nothing has an address to track: the live feed,
// cross-chain rollup, and address_id on findings all hang off this table.
engagementsRouter.get(
  "/engagements/:id/wallets",
  withTenant(async (req, res, client) => {
    const rows = await client.query(
      `SELECT * FROM wallets_contracts WHERE engagement_id = $1 ORDER BY chain, address`,
      [req.params.id]
    );
    res.json({ data: rows.rows });
  })
);

const createWalletBody = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte address"),
  chain: z.enum(["ethereum", "arbitrum", "polygon", "optimism", "base"]),
  kind: z.enum(["eoa", "multisig", "contract"]),
  label: z.string().optional(),
  role: z.enum(["treasury", "ops", "deployer", "admin", "custody"]).optional(),
});

engagementsRouter.post(
  "/engagements/:id/wallets",
  withTenant(async (req, res, client) => {
    const engagementId = req.params.id;
    const role = await resolveEngagementRole(client, req.tenant!, engagementId);
    if (role === "client_viewer") return res.status(403).json({ error: "read-only role" });

    const body = createWalletBody.parse(req.body);
    const inserted = await client.query(
      `INSERT INTO wallets_contracts (engagement_id, firm_id, address, chain, kind, label, role)
       VALUES ($1, current_setting('app.firm_id')::uuid, $2,$3,$4,$5,$6)
       RETURNING *`,
      [engagementId, body.address.toLowerCase(), body.chain, body.kind, body.label ?? null, body.role ?? null]
    );
    res.status(201).json({ data: inserted.rows[0] });
  })
);

// Not a modeled table (no dedicated cross-chain-balance entity in §2) —
// derived from wallets_contracts grouped by chain. Reconciliation deltas
// need an on-chain balance feed this schema doesn't wire up yet.
engagementsRouter.get(
  "/engagements/:id/cross-chain",
  withTenant(async (req, res, client) => {
    const rows = await client.query(
      `SELECT chain, count(*) AS wallet_count, count(*) FILTER (WHERE kind = 'contract') AS contract_count
       FROM wallets_contracts
       WHERE engagement_id = $1
       GROUP BY chain`,
      [req.params.id]
    );
    res.json({ data: rows.rows, note: "derived from wallets_contracts; no balance reconciliation feed wired up" });
  })
);

// ---------- Alerts ----------
engagementsRouter.get(
  "/engagements/:id/alert-rules",
  withTenant(async (req, res, client) => {
    const rows = await client.query(`SELECT * FROM alert_rules WHERE engagement_id = $1 ORDER BY created_at`, [req.params.id]);
    res.json({ data: rows.rows });
  })
);

const createAlertRuleBody = z.object({
  name: z.string(),
  condition: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  threshold: z.number().default(0),
  notify: z.string().optional(),
});

engagementsRouter.post(
  "/engagements/:id/alert-rules",
  withTenant(async (req, res, client) => {
    const body = createAlertRuleBody.parse(req.body);
    const firmRow = await client.query<{ firm_id: string }>(`SELECT firm_id FROM engagements WHERE id = $1`, [req.params.id]);
    if (!firmRow.rowCount) return res.status(404).json({ error: "engagement not found" });

    const inserted = await client.query(
      `INSERT INTO alert_rules (engagement_id, firm_id, name, condition, severity, threshold, channel)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, firmRow.rows[0].firm_id, body.name, body.condition, body.severity, body.threshold, body.notify ?? null]
    );
    res.status(201).json({ data: inserted.rows[0] });
  })
);

engagementsRouter.get(
  "/engagements/:id/alerts",
  withTenant(async (req, res, client) => {
    const rows = await client.query(
      `SELECT * FROM alert_instances WHERE engagement_id = $1 ORDER BY triggered_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json({ data: rows.rows, page: { cursor: null, has_more: rows.rows.length === 100 } });
  })
);

// ---------- Live feed (SSE) ----------
// block-sync-polling (worker) writes feed_events and publishes each new row
// to Redis channel feed:<engagementId>; this relays that as SSE. Sends the
// last 50 events as a `backlog` message on connect, then live `tx` messages
// as they're published. EventSource can't carry an Authorization header, so
// the frontend reads this with fetch + a ReadableStream reader instead of
// the native EventSource API — same Bearer-token auth as every other route.
engagementsRouter.get("/engagements/:id/feed/stream", async (req, res) => {
  const engagementId = req.params.id;
  const firmId = req.tenant!.firmId;

  let backlog: unknown[] | null;
  try {
    backlog = await withTenantTransaction(firmId, async (client) => {
      const eng = await client.query(`SELECT id FROM engagements WHERE id = $1`, [engagementId]);
      if (!eng.rowCount) return null;
      const rows = await client.query(
        `SELECT id, chain, block_number, tx_hash, from_address, to_address, value_wei, direction, is_new_counterparty, severity, detected_at
         FROM feed_events WHERE engagement_id = $1 ORDER BY detected_at DESC LIMIT 50`,
        [engagementId]
      );
      return rows.rows.reverse();
    });
  } catch {
    return res.status(500).json({ error: "failed to load feed backlog" });
  }
  if (backlog === null) return res.status(404).json({ error: "engagement not found" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: backlog\ndata: ${JSON.stringify(backlog)}\n\n`);

  // Dedicated connection: ioredis puts a client in subscribe-only mode once
  // SUBSCRIBE is called, so this can't share the app's shared Redis client.
  const subscriber = new IORedis(config.redisUrl);
  await subscriber.subscribe(feedChannel(engagementId));
  subscriber.on("message", (_channel, message) => {
    res.write(`event: tx\ndata: ${message}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    subscriber.disconnect();
  });
});

// ---------- NLQ ----------
// Resolving a question to structured queries + citations against an LLM
// is a separate integration this migration doesn't build.
engagementsRouter.post("/engagements/:id/nlq", requireAuth, (_req, res) => {
  res.status(501).json({ error: "nlq resolver not implemented" });
});
