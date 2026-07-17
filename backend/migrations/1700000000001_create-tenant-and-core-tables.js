/**
 * Step 1 of 5: create every table fresh, with NO firm_id/client_org_id yet.
 * Tenant columns are added in migration 002 and locked down in 004/005 —
 * this keeps the sequence identical whether we're migrating an existing
 * backend or seeding one from scratch (per the requested 5-step rollout).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // ---------- §1 tenant tables ----------
  pgm.sql(`
    CREATE TABLE firms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      plan text NOT NULL CHECK (plan IN ('trial','standard','enterprise')),
      sso_domain text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      name text NOT NULL,
      mfa_enabled boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE firm_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('partner','lead_auditor','staff_auditor','firm_admin')),
      status text NOT NULL CHECK (status IN ('invited','active','suspended')),
      invited_by uuid REFERENCES users(id),
      joined_at timestamptz,
      UNIQUE (firm_id, user_id)
    );
  `);

  pgm.sql(`
    CREATE TABLE client_orgs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      name text NOT NULL
    );
  `);

  pgm.sql(`
    CREATE TABLE client_org_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_org_id uuid NOT NULL REFERENCES client_orgs(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('client_viewer')),
      UNIQUE (user_id, client_org_id)
    );
  `);

  // ---------- §2 core entities ----------
  pgm.sql(`
    CREATE TABLE engagements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      ticker text,
      entity_type text CHECK (entity_type IN ('defi_lending','dao_treasury','l2_infra','other')),
      fiscal_period text,
      chains jsonb NOT NULL DEFAULT '[]',
      coverage_pct numeric,
      risk_score integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // principal_id is polymorphic (users.id or client_org_members.id) — no single FK.
  pgm.sql(`
    CREATE TABLE engagement_access (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      principal_type text NOT NULL CHECK (principal_type IN ('user','client_org_member')),
      principal_id uuid NOT NULL,
      role_override text
    );
  `);

  pgm.sql(`
    CREATE TABLE wallets_contracts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      address varchar(42) NOT NULL,
      chain text NOT NULL CHECK (chain IN ('ethereum','arbitrum','polygon','optimism','base')),
      kind text NOT NULL CHECK (kind IN ('eoa','multisig','contract')),
      label text,
      role text CHECK (role IN ('treasury','ops','deployer','admin','custody')),
      verified boolean NOT NULL DEFAULT false,
      admin_of uuid[] NOT NULL DEFAULT '{}'
    );
  `);

  pgm.sql(`
    CREATE TABLE findings (
      id text PRIMARY KEY,
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      title text NOT NULL,
      category text,
      assertion text NOT NULL CHECK (assertion IN
        ('existence','completeness','rights_obligations','valuation','presentation','cutoff','classification')),
      impact integer NOT NULL CHECK (impact BETWEEN 1 AND 5),
      likelihood integer NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
      severity text NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
      description text,
      address_id uuid REFERENCES wallets_contracts(id),
      tx_hash text,
      status text NOT NULL CHECK (status IN ('open','monitoring','escalated','resolved')),
      detected_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      finding_id text NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
      type text NOT NULL CHECK (type IN ('tx','contract','flow','document')),
      ref text NOT NULL,
      block_number bigint,
      description text,
      verified boolean NOT NULL DEFAULT false
    );
  `);

  // Append-only by design — see the trigger below and §6 of the schema doc.
  pgm.sql(`
    CREATE TABLE audit_trail (
      id bigserial PRIMARY KEY,
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      ts timestamptz NOT NULL DEFAULT now(),
      actor_id uuid REFERENCES users(id),
      action text NOT NULL,
      target_type text NOT NULL,
      target_id text NOT NULL,
      status text NOT NULL,
      hash_prev char(64) NOT NULL,
      hash_self char(64) NOT NULL
    );
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION audit_trail_append_only() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_trail is append-only: % not permitted', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER audit_trail_no_update
      BEFORE UPDATE ON audit_trail
      FOR EACH ROW EXECUTE FUNCTION audit_trail_append_only();
  `);
  pgm.sql(`
    CREATE TRIGGER audit_trail_no_delete
      BEFORE DELETE ON audit_trail
      FOR EACH ROW EXECUTE FUNCTION audit_trail_append_only();
  `);

  pgm.sql(`
    CREATE TABLE sign_offs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      assertion text NOT NULL CHECK (assertion IN
        ('existence','completeness','rights_obligations','valuation','presentation','cutoff','classification')),
      reviewer_id uuid NOT NULL REFERENCES users(id),
      status text NOT NULL CHECK (status IN ('pending','in_review','approved','rejected')),
      note text,
      decided_at timestamptz
    );
  `);

  pgm.sql(`
    CREATE TABLE token_holdings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      assertion text,
      symbol text NOT NULL,
      name text,
      standard text,
      contract_address varchar(42),
      held numeric,
      value_usd numeric,
      custody text,
      reconciled boolean NOT NULL DEFAULT false,
      note text
    );
  `);

  pgm.sql(`
    CREATE TABLE contract_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      assertion text,
      name text NOT NULL,
      address varchar(42),
      verified boolean NOT NULL DEFAULT false,
      proxy_type text,
      admin text,
      privileges text[] NOT NULL DEFAULT '{}',
      centralization text CHECK (centralization IN ('High','Medium','Low')),
      severity text CHECK (severity IN ('critical','high','medium','low','info')),
      note text
    );
  `);

  pgm.sql(`
    CREATE TABLE governance_actions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      assertion text,
      type text CHECK (type IN ('proposal','parameter','timelock')),
      title text NOT NULL,
      actor text,
      status text,
      block_number bigint,
      occurred_at timestamptz,
      impact text CHECK (impact IN ('high','medium','low'))
    );
  `);

  pgm.sql(`
    CREATE TABLE tokenomics_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      assertion text,
      event text NOT NULL,
      onchain_desc text,
      treatment text,
      standard text,
      amount_usd numeric,
      flag text CHECK (flag IN ('ok','review','alert')),
      note text
    );
  `);

  pgm.sql(`
    CREATE TABLE validators (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      active_count integer,
      effective_balance text,
      attestation_rate numeric,
      proposed integer,
      missed integer,
      slashing integer,
      mev_reward text,
      withdrawal_creds text,
      note text
    );
  `);

  pgm.sql(`
    CREATE TABLE alert_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      name text NOT NULL,
      condition text NOT NULL,
      severity text NOT NULL CHECK (severity IN ('critical','high','medium','low')),
      enabled boolean NOT NULL DEFAULT true,
      threshold numeric NOT NULL DEFAULT 0,
      channel text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE alert_instances (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      severity text NOT NULL,
      text text NOT NULL,
      entity_ref text,
      triggered_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Firm-wide procedure library — not tied to one engagement.
  pgm.sql(`
    CREATE TABLE query_library (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      assertion text,
      category text,
      engine text,
      sql text NOT NULL,
      status text,
      last_run timestamptz
    );
  `);

  pgm.sql(`
    CREATE TABLE query_executions (
      id text PRIMARY KEY,
      query_id uuid NOT NULL REFERENCES query_library(id) ON DELETE CASCADE,
      engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL,
      status text NOT NULL CHECK (status IN ('queued','executing','completed','error')),
      rows_scanned bigint,
      credits_used integer,
      started_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz,
      result jsonb
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS query_executions;`);
  pgm.sql(`DROP TABLE IF EXISTS query_library;`);
  pgm.sql(`DROP TABLE IF EXISTS alert_instances;`);
  pgm.sql(`DROP TABLE IF EXISTS alert_rules;`);
  pgm.sql(`DROP TABLE IF EXISTS validators;`);
  pgm.sql(`DROP TABLE IF EXISTS tokenomics_events;`);
  pgm.sql(`DROP TABLE IF EXISTS governance_actions;`);
  pgm.sql(`DROP TABLE IF EXISTS contract_profiles;`);
  pgm.sql(`DROP TABLE IF EXISTS token_holdings;`);
  pgm.sql(`DROP TABLE IF EXISTS sign_offs;`);
  pgm.sql(`DROP TRIGGER IF EXISTS audit_trail_no_delete ON audit_trail;`);
  pgm.sql(`DROP TRIGGER IF EXISTS audit_trail_no_update ON audit_trail;`);
  pgm.sql(`DROP FUNCTION IF EXISTS audit_trail_append_only;`);
  pgm.sql(`DROP TABLE IF EXISTS audit_trail;`);
  pgm.sql(`DROP TABLE IF EXISTS evidence;`);
  pgm.sql(`DROP TABLE IF EXISTS findings;`);
  pgm.sql(`DROP TABLE IF EXISTS wallets_contracts;`);
  pgm.sql(`DROP TABLE IF EXISTS engagement_access;`);
  pgm.sql(`DROP TABLE IF EXISTS engagements;`);
  pgm.sql(`DROP TABLE IF EXISTS client_org_members;`);
  pgm.sql(`DROP TABLE IF EXISTS client_orgs;`);
  pgm.sql(`DROP TABLE IF EXISTS firm_memberships;`);
  pgm.sql(`DROP TABLE IF EXISTS users;`);
  pgm.sql(`DROP TABLE IF EXISTS firms;`);
};
