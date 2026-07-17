/**
 * Step 2 of 5: add firm_id (nullable, no FK yet) to every tenant-scoped
 * table, plus client_org_id on engagements. Kept nullable + unconstrained
 * here so the backfill in 003 can run against a table that isn't yet
 * enforcing NOT NULL — constraints land in 004.
 */

const TENANT_TABLES = [
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
];

exports.shorthands = undefined;

exports.up = (pgm) => {
  for (const table of TENANT_TABLES) {
    pgm.sql(`ALTER TABLE ${table} ADD COLUMN firm_id uuid;`);
  }
  pgm.sql(`ALTER TABLE engagements ADD COLUMN client_org_id uuid;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE engagements DROP COLUMN IF EXISTS client_org_id;`);
  for (const table of TENANT_TABLES.slice().reverse()) {
    pgm.sql(`ALTER TABLE ${table} DROP COLUMN IF EXISTS firm_id;`);
  }
};
