/**
 * Step 3 of 5: seed + backfill.
 *
 * This repo has no pre-existing production data, so "backfill" here means
 * seed one default firm and attach every table to it — but the mechanics
 * (backfill via join through engagement_id) are written the way they'd
 * have to run against a live, populated database, so this migration is
 * the real thing, not a placeholder.
 */

const ENGAGEMENT_JOIN_TABLES = [
  'wallets_contracts',
  'findings',
  'evidence',
  'audit_trail',
  'sign_offs',
  'token_holdings',
  'contract_profiles',
  'governance_actions',
  'tokenomics_events',
  'validators',
  'alert_rules',
  'alert_instances',
];

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO firms (id, name, slug, plan, created_at)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Default Firm', 'default', 'standard', now())
    ON CONFLICT (id) DO NOTHING;
  `);

  // engagements is the root of the join chain — backfill it directly first.
  pgm.sql(`
    UPDATE engagements
    SET firm_id = '00000000-0000-0000-0000-000000000001'
    WHERE firm_id IS NULL;
  `);

  // Every other tenant table reaches its firm through engagement_id.
  for (const table of ENGAGEMENT_JOIN_TABLES) {
    pgm.sql(`
      UPDATE ${table} AS t
      SET firm_id = e.firm_id
      FROM engagements AS e
      WHERE t.engagement_id = e.id
        AND t.firm_id IS NULL;
    `);
  }

  // query_library has no engagement_id — it's a firm-owned procedure
  // library, so seed it onto the default firm directly.
  pgm.sql(`
    UPDATE query_library
    SET firm_id = '00000000-0000-0000-0000-000000000001'
    WHERE firm_id IS NULL;
  `);

  // query_executions: backfill via engagement_id where present, otherwise
  // fall back to the firm that owns the query itself (an execution not
  // run against a specific engagement, e.g. an ad hoc library test run).
  pgm.sql(`
    UPDATE query_executions AS t
    SET firm_id = e.firm_id
    FROM engagements AS e
    WHERE t.engagement_id = e.id
      AND t.firm_id IS NULL;
  `);
  pgm.sql(`
    UPDATE query_executions AS t
    SET firm_id = q.firm_id
    FROM query_library AS q
    WHERE t.query_id = q.id
      AND t.firm_id IS NULL;
  `);
};

exports.down = (pgm) => {
  // Reversible in the sense that it undoes the assignment; it does not
  // (and cannot) resurrect the pre-migration "no firm" state on a live
  // system, since that state was the bug being fixed.
  pgm.sql(`UPDATE query_executions SET firm_id = NULL WHERE firm_id = '00000000-0000-0000-0000-000000000001';`);
  pgm.sql(`UPDATE query_library SET firm_id = NULL WHERE firm_id = '00000000-0000-0000-0000-000000000001';`);
  for (const table of ENGAGEMENT_JOIN_TABLES.slice().reverse()) {
    pgm.sql(`UPDATE ${table} SET firm_id = NULL WHERE firm_id = '00000000-0000-0000-0000-000000000001';`);
  }
  pgm.sql(`UPDATE engagements SET firm_id = NULL WHERE firm_id = '00000000-0000-0000-0000-000000000001';`);
  pgm.sql(`DELETE FROM firms WHERE id = '00000000-0000-0000-0000-000000000001';`);
};
