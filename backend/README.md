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

## What's stubbed, honestly

- `GET /v1/engagements/:id/feed/stream` — returns 501. Needs an RPC
  subscription relayed through the worker; not built here.
- `POST /v1/engagements/:id/nlq` — returns 501. Needs an LLM integration;
  not built here.
- `block-sync-polling` / `alert-rule-evaluation` processors — correct
  tenant-scoped iteration pattern, condition/anomaly evaluation itself is
  a `TODO` pending the live feed table.
- `workpaper-generation` — produces a JSON snapshot of the requested
  sections and uploads it to S3-compatible storage; real PDF/XLSX
  rendering is a follow-up.
