# ChainProof backend

Multi-tenant REST API + worker for the audit engagement backend described in
`Backend API Schema.html` (§1–6), built with multi-tenancy from day one per
the schema's own §1 design (firms / users / firm_memberships / client_orgs /
client_org_members / engagement_access, denormalized `firm_id` + Postgres
row-level security on every tenant table).

## Layout

- `migrations/` — 6 reversible node-pg-migrate migrations, run in order:
  1. create every table fresh (no `firm_id` yet)
  2. add nullable `firm_id` / `client_org_id` columns
  3. seed a default firm + backfill `firm_id` (via join through `engagement_id`)
  4. `firm_id` → `NOT NULL` + FK constraints + indexes
  5. enable RLS (`USING (firm_id = current_setting('app.firm_id', true)::uuid)`)
  6. `workpaper_jobs` table (created tenant-scoped from the start)
  7. add `users.password_hash` (nullable — see Auth model below)
  8. `feed_events` (live feed, tenant-scoped) + `chain_sync_state` (poller cursor, not tenant data)
- `src/db.ts` — `withTenantTransaction(firmId, fn)` is the only sanctioned way
  to touch a tenant table; it sets `app.firm_id` via `set_config` before `fn` runs.
- `src/middleware/auth.ts` — verifies the bearer JWT, populates `req.tenant`.
- `src/middleware/tenantContext.ts` — wraps route handlers in a tenant transaction;
  `resolveEngagementRole` applies `engagement_access.role_override` when present.
- `src/auditTrail.ts` — hash-chained, append-only audit log writer + verifier (§6).
- `src/routes/` — one file per resource group from §3 of the schema doc.
- `src/worker/` — BullMQ queues + processors: alert-rule evaluation and
  block-sync polling run on a schedule; Dune execution and workpaper
  generation are enqueued on demand by the API.

## Running locally

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL / REDIS_URL at minimum
npm run migrate:up
npm run dev:api         # in one shell
npm run dev:worker      # in another
```

## Tests

`test/rls.test.ts` is the fail-closed RLS check: a query issued without
`app.firm_id` set must return zero rows, not an error, not unfiltered data.
Requires a real Postgres with migrations applied — point `DATABASE_URL` at a
disposable database before running:

```bash
npm test
```

## Auth model

JWT claims: `{ user_id, firm_id, role, client_org_id? }`. One token = one
firm's context. A user in multiple firms calls `POST /v1/auth/switch-firm`
to get a token reissued for a different membership — tokens never carry more
than one firm's scope at once.

Role resolution order: `engagement_access.role_override` for that user on
that engagement (if a row exists and isn't null) → otherwise the firm-wide
role from `firm_memberships`.

**Getting a first token.** There's no self-service signup — real firm
onboarding is an invite flow (`firm_memberships.invited_by`), not an open
endpoint, and that invite flow isn't built yet. To create a user to log in
with:

```bash
SEED_EMAIL=you@example.com SEED_PASSWORD='...' SEED_NAME="Your Name" \
  npm run seed:user
```

Defaults to the seeded default firm (`00000000-0000-0000-0000-000000000001`)
with role `partner`; override with `SEED_FIRM_ID` / `SEED_ROLE`. Idempotent —
re-running updates the password/role rather than erroring. Then:

```bash
curl -X POST https://<api-host>/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'
```

returns `{ token }` — use it as `Authorization: Bearer <token>` on everything else.

## Live feed

`block-sync-polling` (worker, every 15s) polls the single configured RPC
endpoint (`RPC_PROVIDER_URL`, tagged with which `wallets_contracts.chain`
value it serves via `RPC_CHAIN` — this backend doesn't multiplex multiple
RPC endpoints per chain) for new blocks via `eth_getBlockByNumber`, matches
transactions against every firm's tracked wallets, and writes a row to
`feed_events` for each match — capped at `MAX_BLOCKS_PER_TICK` (25) blocks
per tick so a gap since the last tick can't turn into an unbounded
catch-up burst. Cold start baselines at the chain tip rather than
backfilling history. Each insert is published to Redis channel
`feed:<engagementId>`.

`GET /v1/engagements/:id/feed/stream` relays that as SSE: the last 50
`feed_events` rows as a `backlog` message on connect, then live `tx`
messages as they're published. Severity is a naive value-threshold
heuristic over real on-chain amounts (not behavioral/counterparty-risk
scoring) — see `severityFor` in `blockSyncPolling.ts`.

## Counterparty intelligence

`counterparty_labels` is manually-curated address → name/category/risk_tier
intel, scoped per engagement (`POST /v1/engagements/:id/counterparties`,
restricted like other write routes). `GET /v1/engagements/:id/counterparties`
doesn't just return that table — it derives the counterparty list by
grouping `feed_events` by the "other side" of each transaction (real
on-chain activity from tracked wallets), then left-joins the label. So an
address shows up here as soon as a tracked wallet has actually transacted
with it, labeled or not; there's no separate "add a counterparty" step
disconnected from real activity.

## Fund-flow trace

`GET /v1/engagements/:id/fund-flow` groups `feed_events` by tracked wallet
and counterparty, giving real in/out flow per wallet. It is **not** a
multi-hop trace through untracked third parties — the poller only records
activity where one side is a tracked `wallets_contracts` row, so a
counterparty's own onward transactions aren't visible unless that address
is also separately tracked. Treat this as "confirmed direct flow," not a
full fund-flow graph.

## AI query (NLQ)

`POST /v1/engagements/:id/nlq` (`src/nlq.ts`) grounds a real Claude API
call in this engagement's actual data — a bounded sample of findings,
`feed_events`, counterparty exposure, token holdings, and contract
profiles is sent as the model's *only* source of truth, with instructions
to say so rather than invent facts if the data's insufficient. The model
is asked to return `{answer, citations}` as JSON; citations reference real
row ids/tx hashes/addresses from the data it was given.

Requires `ANTHROPIC_API_KEY` (optionally `ANTHROPIC_MODEL`, default
`claude-sonnet-5`) on the API service — without it, returns 501 rather
than a fabricated answer.

## What's stubbed, honestly

- `alert-rule-evaluation` processor — correct tenant-scoped iteration
  pattern; evaluating `alert_rules.condition` against `feed_events` is a
  `TODO`, so alert rules can be created but never fire yet.
- `workpaper-generation` — produces a JSON snapshot of the requested
  sections and uploads it to S3-compatible storage; real PDF/XLSX
  rendering is a follow-up.
