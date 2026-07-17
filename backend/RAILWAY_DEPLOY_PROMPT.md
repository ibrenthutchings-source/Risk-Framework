# Railway deploy prompt

Copy-paste this into a fresh Claude Code session (with the `use-railway`
skill available) to deploy the ChainProof backend. It has NOT been run —
deploying is a real, hard-to-reverse action against live infrastructure and
secrets, so it's left for you to trigger deliberately.

---

Deploy the ChainProof backend (API + worker + Postgres + Redis) to Railway.
The code lives in `backend/` at the repo root — a Node.js/TypeScript service
already built multi-tenant (Postgres row-level security keyed on `firm_id`,
set per-request from a JWT claim). Don't redesign anything; wire up what's
already there.

**Services (4, in one Railway project):**

- `api` — the REST service.
  - Build: Dockerfile at `backend/Dockerfile.api`.
  - Config: `backend/railway.api.json` (start command, health check path
    `/health`, and a `preDeployCommand` that runs `npm run migrate:up` as a
    release step — confirm this runs once per deploy, not once per replica,
    and that Railway's current schema still calls this field
    `preDeployCommand`; check `railway.app/railway.schema.json` if unsure).
  - `/health` returns 200 only once both the Postgres and Redis connections
    are live (see `backend/src/api/index.ts`) — use it as the health check.
- `worker` — background jobs on BullMQ/Redis: alert-rule evaluation and
  block-sync polling run on a schedule; Dune execution and workpaper
  generation are enqueued by the API. No public port.
  - Build: Dockerfile at `backend/Dockerfile.worker`.
  - Config: `backend/railway.worker.json`.
- **Postgres** — Railway's Postgres plugin.
- **Redis** — Railway's Redis plugin.

**Environments:** create `staging` and `production`, each with its own
Postgres and Redis plugin instances — do not share databases across
environments. Wire `api` and `worker` in each environment to that
environment's own DB/Redis via Railway's internal networking variables
(`DATABASE_URL`, `REDIS_URL` — reference the plugin variables, never
hardcode a connection string).

**Secrets** (Railway service variables, set separately per environment —
staging and production must not share keys, especially RPC/Dune, to avoid
burning shared rate limits):

- `DATABASE_URL`, `REDIS_URL` — from the plugins, referenced not hardcoded
- `JWT_SECRET`
- `DUNE_API_KEY`
- `RPC_PROVIDER_URL`, `RPC_API_KEY` (Alchemy/Infura/etc.)
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_ENDPOINT`
  (R2 or S3 — used by the workpaper-generation worker job)

See `backend/.env.example` for the full list with descriptions.

**Networking:** `api` gets a public Railway domain; `worker` and both
plugins stay private, internal-only. There is no WebSocket/SSE live-feed
endpoint wired up yet (`GET /v1/engagements/:id/feed/stream` currently
returns 501 — it's a stub pending an RPC-subscription integration), so
sticky-connection support isn't a blocker for this deploy; note it as a
follow-up when that endpoint is built.

**Post-deploy checklist — script or verify manually, on both environments:**

- [ ] `GET /health` returns 200
- [ ] migrations applied cleanly — check `pgmigrations` (node-pg-migrate's
      tracking table) has all 6 entries
- [ ] `test/rls.test.ts` passes against each environment's database (fail-closed
      RLS check — confirms a query without `app.firm_id` set returns zero rows)
- [ ] worker connects to Redis and picks up a test job (enqueue a trivial
      job on `workpaper-generation` or `dune-execution` and confirm it's
      claimed)
- [ ] no secret values appear in build logs
- [ ] staging and production are fully isolated: separate DB, separate
      Redis, separate Dune/RPC keys — confirm by checking the actual
      variable values differ, not just that both are "set"

**Output:** a summary of the services created, the environment variable
*names* set per service (never values), and the public URL for `api` in
each environment.
