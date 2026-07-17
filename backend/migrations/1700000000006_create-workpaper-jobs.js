/**
 * workpaper_jobs backs POST /v1/engagements/:id/workpapers and GET
 * /v1/workpapers/:job_id. It's a separate migration from 001 because it
 * wasn't part of the original 5-step tenant rollout — it's created
 * tenant-scoped from the start (api and worker are separate Railway
 * services / processes, so job status can't live in process memory).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE workpaper_jobs (
      id uuid PRIMARY KEY,
      firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      sections text[] NOT NULL,
      format text NOT NULL CHECK (format IN ('pdf','xlsx','docx')),
      status text NOT NULL CHECK (status IN ('queued','generating','complete','error')) DEFAULT 'queued',
      download_url text,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX workpaper_jobs_firm_id_idx ON workpaper_jobs (firm_id);`);
  pgm.sql(`ALTER TABLE workpaper_jobs ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`ALTER TABLE workpaper_jobs FORCE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY workpaper_jobs_tenant_isolation ON workpaper_jobs
      USING (firm_id = current_setting('app.firm_id', true)::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS workpaper_jobs;`);
};
