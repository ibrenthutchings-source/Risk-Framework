import { Pool, PoolClient } from "pg";
import { config } from "./config";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

/**
 * Every tenant-scoped query MUST go through here. It opens a transaction,
 * sets the Postgres session var RLS policies key off (via set_config, since
 * SET doesn't accept bind parameters), runs the callback, then commits or
 * rolls back. `firmId` comes from the verified JWT — never from a client-
 * supplied query param or body field.
 */
export async function withTenantTransaction<T>(
  firmId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // third arg `true` = local to this transaction only, cleared on commit/rollback.
    await client.query("SELECT set_config('app.firm_id', $1, true)", [firmId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * For system/worker code that legitimately needs to operate across firms
 * (e.g. "evaluate alert rules for every firm"): iterate firm-by-firm and
 * scope each pass with withTenantTransaction. There is no bypass-RLS
 * connection mode in this codebase — cross-tenant access always means
 * "loop over firms", never "turn off the isolation".
 */
export async function withSystemTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
