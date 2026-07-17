/**
 * Step 5 of 5: enable RLS last, only after 003/004 proved the backfill
 * complete and firm_id is NOT NULL everywhere.
 *
 * Policy uses current_setting('app.firm_id', true) — the `true` (missing_ok)
 * argument means an unset session var returns SQL NULL instead of raising,
 * and `firm_id = NULL` is never true, so a request that forgot to set
 * app.firm_id gets zero rows back (fail-closed), not an error and not an
 * unfiltered table. FORCE ROW LEVEL SECURITY so this also applies to the
 * table owner / app DB role, not just non-owner callers.
 */

const RLS_TABLES = [
  'engagements',
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
  'query_library',
  'query_executions',
  // Also tenant-scoped and already carry firm_id directly from §1 — closing
  // the same isolation gap here rather than leaving them unprotected.
  'firm_memberships',
  'client_orgs',
];

exports.shorthands = undefined;

exports.up = (pgm) => {
  for (const table of RLS_TABLES) {
    pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    pgm.sql(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    pgm.sql(`
      CREATE POLICY ${table}_tenant_isolation ON ${table}
        USING (firm_id = current_setting('app.firm_id', true)::uuid);
    `);
  }

  // Not currently covered: client_org_members and engagement_access don't
  // carry firm_id directly (they key off client_org_id / engagement_id).
  // Scoping those correctly needs a subquery-based policy against
  // client_orgs / engagements rather than a flat column comparison —
  // left as a follow-up rather than bolted on here.
};

exports.down = (pgm) => {
  for (const table of RLS_TABLES.slice().reverse()) {
    pgm.sql(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table};`);
    pgm.sql(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY;`);
    pgm.sql(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
  }
};
