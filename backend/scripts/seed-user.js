// One-off bootstrap: there's no self-service signup (real firm onboarding
// is an invite flow, not an open endpoint), so this is how the first user
// gets created to log in with at all. Reads from env vars rather than
// argv so the password doesn't land in shell history.
//
// Usage:
//   SEED_EMAIL=you@example.com SEED_PASSWORD=... SEED_NAME="Your Name" \
//     [SEED_FIRM_ID=00000000-0000-0000-0000-000000000001] [SEED_ROLE=partner] \
//     node scripts/seed-user.js
//
// Idempotent: re-running with the same email updates the password/role
// rather than erroring.

require("dotenv/config");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const DEFAULT_FIRM_ID = "00000000-0000-0000-0000-000000000001"; // seeded in migration 003

async function main() {
  const email = requireEnv("SEED_EMAIL");
  const password = requireEnv("SEED_PASSWORD");
  const name = process.env.SEED_NAME || email;
  const firmId = process.env.SEED_FIRM_ID || DEFAULT_FIRM_ID;
  const role = process.env.SEED_ROLE || "partner";

  const validRoles = ["partner", "lead_auditor", "staff_auditor", "firm_admin"];
  if (!validRoles.includes(role)) {
    throw new Error(`SEED_ROLE must be one of ${validRoles.join(", ")}`);
  }

  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  const passwordHash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = await client.query(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
       RETURNING id`,
      [email, name, passwordHash]
    );
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO firm_memberships (firm_id, user_id, role, status, joined_at)
       VALUES ($1, $2, $3, 'active', now())
       ON CONFLICT (firm_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [firmId, userId, role]
    );

    await client.query("COMMIT");
    console.log(`Seeded user ${email} (${userId}) as ${role} on firm ${firmId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
