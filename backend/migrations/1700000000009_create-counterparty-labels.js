/**
 * Backs Counterparty Intel. `counterparty_labels` is manually-curated
 * address -> name/category/risk_tier, scoped per engagement (like
 * wallets_contracts) since how an auditor labels a counterparty can be
 * engagement-specific. Exposure stats (tx count, volume, first/last seen)
 * are NOT stored here — they're derived by joining this against
 * feed_events at query time, since that's already real on-chain activity
 * for this engagement's tracked wallets.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE counterparty_labels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      chain text NOT NULL CHECK (chain IN ('ethereum','arbitrum','polygon','optimism','base')),
      address text NOT NULL,
      name text,
      category text NOT NULL CHECK (category IN ('exchange','bridge','mixer','market_maker','protocol','sanctioned','unknown')) DEFAULT 'unknown',
      risk_tier text NOT NULL CHECK (risk_tier IN ('low','medium','high','critical')) DEFAULT 'low',
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (engagement_id, chain, address)
    );
  `);
  pgm.sql(`CREATE INDEX counterparty_labels_engagement_idx ON counterparty_labels (engagement_id);`);
  pgm.sql(`ALTER TABLE counterparty_labels ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE counterparty_labels FORCE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY counterparty_labels_tenant_isolation ON counterparty_labels
      USING (firm_id = current_setting('app.firm_id', true)::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS counterparty_labels;`);
};
