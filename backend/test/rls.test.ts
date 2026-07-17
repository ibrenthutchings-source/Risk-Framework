/**
 * Confirms the fail-closed RLS behavior described in the migration
 * request: a query issued without app.firm_id set must return zero rows,
 * not an error and not every firm's rows.
 *
 * Requires a real Postgres reachable via DATABASE_URL with migrations
 * already applied (`npm run migrate:up`). Run against a disposable test
 * database — this test inserts and deletes a second firm + engagement.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { config } from "../src/config";

const pool = new Pool({ connectionString: config.databaseUrl });

const FIRM_A = "00000000-0000-0000-0000-0000000000a1";
const FIRM_B = "00000000-0000-0000-0000-0000000000b1";
let engagementA: string;
let engagementB: string;

before(async () => {
  await pool.query(`INSERT INTO firms (id, name, slug, plan) VALUES ($1,'RLS Test A','rls-test-a','trial') ON CONFLICT (id) DO NOTHING`, [FIRM_A]);
  await pool.query(`INSERT INTO firms (id, name, slug, plan) VALUES ($1,'RLS Test B','rls-test-b','trial') ON CONFLICT (id) DO NOTHING`, [FIRM_B]);

  const a = await pool.query(`INSERT INTO engagements (firm_id, name) VALUES ($1,'A Co') RETURNING id`, [FIRM_A]);
  engagementA = a.rows[0].id;
  const b = await pool.query(`INSERT INTO engagements (firm_id, name) VALUES ($1,'B Co') RETURNING id`, [FIRM_B]);
  engagementB = b.rows[0].id;
});

after(async () => {
  await pool.query(`DELETE FROM engagements WHERE id = ANY($1)`, [[engagementA, engagementB]]);
  await pool.query(`DELETE FROM firms WHERE id = ANY($1)`, [[FIRM_A, FIRM_B]]);
  await pool.end();
});

test("query without app.firm_id set returns zero rows, not an error", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // deliberately not calling set_config('app.firm_id', ...)
    const result = await client.query("SELECT * FROM engagements");
    assert.equal(result.rowCount, 0, "expected fail-closed: zero rows when app.firm_id is unset");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("query with app.firm_id set sees only that firm's rows", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.firm_id', $1, true)", [FIRM_A]);
    const result = await client.query("SELECT id, name FROM engagements");
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].id, engagementA);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("app.firm_id from one firm cannot see another firm's rows", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.firm_id', $1, true)", [FIRM_A]);
    const result = await client.query("SELECT id FROM engagements WHERE id = $1", [engagementB]);
    assert.equal(result.rowCount, 0, "firm A's session must not see firm B's engagement");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
