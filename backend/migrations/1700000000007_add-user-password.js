/**
 * users had no way to authenticate at all — the schema doc's auth model
 * (§5) starts from "JWT bearer, claims carry firm_id + role" and never
 * specifies how someone gets that first token. Adding a minimal password
 * login path so the deployed API is actually testable.
 *
 * Nullable: SSO-domain firms (firms.sso_domain) are expected to
 * authenticate a different way later; this isn't meant to be the only
 * path forever.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE users ADD COLUMN password_hash text;`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS password_hash;`);
};
