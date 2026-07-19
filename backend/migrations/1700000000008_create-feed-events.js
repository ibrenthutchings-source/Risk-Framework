/**
 * Backs the live feed (worker writes, GET /v1/engagements/:id/feed/stream
 * reads + relays via Redis pub/sub). `chain_sync_state` is not tenant data
 * (just a per-chain block cursor for the poller) so it isn't RLS-protected.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE feed_events (
      id bigserial PRIMARY KEY,
      firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      wallet_id uuid NOT NULL REFERENCES wallets_contracts(id) ON DELETE CASCADE,
      chain text NOT NULL,
      block_number bigint NOT NULL,
      tx_hash text NOT NULL,
      from_address text NOT NULL,
      to_address text,
      value_wei numeric NOT NULL,
      direction text NOT NULL CHECK (direction IN ('in','out')),
      is_new_counterparty boolean NOT NULL DEFAULT false,
      severity text NOT NULL CHECK (severity IN ('critical','high','medium','low','info')) DEFAULT 'info',
      detected_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (wallet_id, tx_hash, direction)
    );
  `);
  pgm.sql(`CREATE INDEX feed_events_engagement_idx ON feed_events (engagement_id, detected_at DESC);`);
  pgm.sql(`ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE feed_events FORCE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY feed_events_tenant_isolation ON feed_events
      USING (firm_id = current_setting('app.firm_id', true)::uuid);
  `);

  pgm.sql(`
    CREATE TABLE chain_sync_state (
      chain text PRIMARY KEY,
      last_block bigint NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS chain_sync_state;`);
  pgm.sql(`DROP POLICY IF EXISTS feed_events_tenant_isolation ON feed_events;`);
  pgm.sql(`DROP TABLE IF EXISTS feed_events;`);
};
