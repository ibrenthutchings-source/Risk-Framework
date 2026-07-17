/**
 * Step 4 of 5: lock down what 003 backfilled — NOT NULL + FK on firm_id
 * everywhere, plus the FK on engagements.client_org_id. Indexes on
 * firm_id are added here too since every RLS policy in 005 filters on it.
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
    pgm.sql(`ALTER TABLE ${table} ALTER COLUMN firm_id SET NOT NULL;`);
    pgm.sql(`
      ALTER TABLE ${table}
        ADD CONSTRAINT ${table}_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE;
    `);
    pgm.sql(`CREATE INDEX ${table}_firm_id_idx ON ${table} (firm_id);`);
  }

  // client_org_id stays nullable — not every engagement has client-portal
  // access provisioned yet — but once set it must point at a real client_org.
  pgm.sql(`
    ALTER TABLE engagements
      ADD CONSTRAINT engagements_client_org_id_fkey FOREIGN KEY (client_org_id) REFERENCES client_orgs(id) ON DELETE SET NULL;
  `);
  pgm.sql(`CREATE INDEX engagements_client_org_id_idx ON engagements (client_org_id) WHERE client_org_id IS NOT NULL;`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS engagements_client_org_id_idx;`);
  pgm.sql(`ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_client_org_id_fkey;`);

  for (const table of TENANT_TABLES.slice().reverse()) {
    pgm.sql(`DROP INDEX IF EXISTS ${table}_firm_id_idx;`);
    pgm.sql(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_firm_id_fkey;`);
    pgm.sql(`ALTER TABLE ${table} ALTER COLUMN firm_id DROP NOT NULL;`);
  }
};
