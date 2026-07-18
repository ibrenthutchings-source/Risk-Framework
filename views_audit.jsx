// views_audit.jsx — Audit Trail + Governance (real API data)
const { useState: useStateAT } = React;

const SIGNOFF_TONE = { pending: "neutral", in_review: "warn", approved: "ok", rejected: "bad" };
const IMPACT_COLOR = { high: "#dc3545", medium: "#e8652a", low: "#1a9d5e" };

function shortId(id) { return id ? id.slice(0, 8) + "…" : "—"; }

// ============ AUDIT TRAIL ============
function AuditTrailView({ client }) {
  const { data: trail, loading: trailLoading, error: trailError, reload: reloadTrail } = useApi(`/v1/engagements/${client.id}/audit-trail`);
  const { data: signOffs, loading: soLoading, error: soError } = useApi(`/v1/engagements/${client.id}/sign-offs`);
  const [verify, setVerify] = useStateAT(null);
  const [verifying, setVerifying] = useStateAT(false);

  const runVerify = async () => {
    setVerifying(true);
    try {
      const res = await apiFetch(`/v1/engagements/${client.id}/audit-trail/verify`);
      setVerify(res);
    } catch (err) {
      setVerify({ valid: false, brokenAt: null, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  if (trailLoading || soLoading) return <div className="view"><LoadingPanel label="Loading audit trail…" /></div>;
  if (trailError) return <div className="view"><ErrorPanel error={trailError} onRetry={reloadTrail} /></div>;
  if (soError) return <div className="view"><ErrorPanel error={soError} /></div>;

  const approved = (signOffs || []).filter((s) => s.status === "approved").length;

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Audit trail events" value={(trail || []).length} sub="this engagement" /></Panel>
        <Panel><Stat label="Sign-offs approved" value={`${approved}/${(signOffs || []).length}`} tone="#1a9d5e" sub="assertion-level approval" /></Panel>
        <Panel><Stat label="Pending review" value={(signOffs || []).filter((s) => s.status !== "approved").length} tone="#e8652a" sub="awaiting sign-off" /></Panel>
        <Panel pad={false}>
          <div style={{ padding: 18 }}>
            <div className="stat-label">Hash-chain integrity</div>
            <button className="btn-sm" style={{ marginTop: 8 }} onClick={runVerify} disabled={verifying}>{verifying ? "Verifying…" : "Verify chain"}</button>
            {verify && (
              <div style={{ marginTop: 8 }}>
                {verify.valid ? <Tag tone="ok">✓ valid</Tag> : <Tag tone="bad">broken at #{verify.brokenAt ?? "?"}</Tag>}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid-2-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="clock" title="Activity timeline" sub="Chronological, append-only, hash-chained" />
          {(!trail || trail.length === 0) ? (
            <EmptyPanel title="No activity yet" sub="Trail events are written automatically as findings are opened, sign-offs decided, etc." />
          ) : (
            <div className="trail-list">
              {trail.map((t, i) => (
                <div className="trail-row" key={t.id}>
                  <div className="trail-line">
                    <div className="trail-dot" style={{ background: "var(--accent)" }} />
                    {i < trail.length - 1 && <div className="trail-stem" />}
                  </div>
                  <div className="trail-body">
                    <div className="trail-top">
                      <span className="trail-action">{t.action}</span>
                      <Tag>{t.status}</Tag>
                    </div>
                    <div className="trail-target">
                      <Tag tone="info">{t.target_type}: {t.target_id}</Tag>
                      <span className="trail-actor">{t.actor_id ? shortId(t.actor_id) : "System"}</span>
                    </div>
                    <div className="trail-ts mono dim">{new Date(t.ts).toISOString().slice(0, 16).replace("T", " ")} UTC</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel pad={false}>
          <PanelHead icon="check" title="Assertion sign-offs" sub="Review & approval matrix" />
          {(!signOffs || signOffs.length === 0) ? (
            <EmptyPanel title="No sign-offs yet" />
          ) : (
            <div className="signoff-list">
              {signOffs.map((s) => (
                <div className={"signoff-row " + s.status} key={s.id}>
                  <div className="signoff-top">
                    <div className="signoff-assertion">{s.assertion}</div>
                    <Tag tone={SIGNOFF_TONE[s.status] || "neutral"}>{s.status}</Tag>
                  </div>
                  <div className="signoff-meta">
                    <span className="signoff-reviewer">Reviewer <span className="mono">{shortId(s.reviewer_id)}</span></span>
                    {s.decided_at && <span className="signoff-date mono dim">{new Date(s.decided_at).toISOString().slice(0, 10)}</span>}
                  </div>
                  {s.note && <div className="signoff-note dim">{s.note}</div>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ============ GOVERNANCE ============
function GovernanceView({ client }) {
  const { data: events, loading, error, reload } = useApi(`/v1/engagements/${client.id}/governance`);

  if (loading) return <div className="view"><LoadingPanel label="Loading governance activity…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = events || [];
  const active = list.filter((e) => e.status === "active");
  const highImpact = list.filter((e) => e.impact === "high");
  const typeLabel = { proposal: "Proposal", parameter: "Parameter Δ", timelock: "Timelock" };

  if (list.length === 0) {
    return <div className="view"><EmptyPanel title="No governance activity recorded" sub="This engagement has no rows in governance_actions yet." /></div>;
  }

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Governance events" value={list.length} sub="proposals + parameters" /></Panel>
        <Panel><Stat label="Active proposals" value={active.length} tone="#3b82f6" sub="voting in progress" /></Panel>
        <Panel><Stat label="Parameter changes" value={list.filter((e) => e.type === "parameter").length} sub="executed this period" /></Panel>
        <Panel><Stat label="High-impact events" value={highImpact.length} tone="#dc3545" sub="affect financial assertions" /></Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="clock" title="Event log" sub="All governance activity this period" />
        <div className="gov-log">
          <div className="gov-th"><div>Type</div><div>Event</div><div>Impact</div><div>Assertion</div><div>Status</div><div className="ta-r">Date</div></div>
          {list.map((e) => (
            <div className="gov-tr" key={e.id}>
              <div><Tag tone={e.type === "proposal" ? "info" : e.type === "parameter" ? "warn" : "neutral"}>{typeLabel[e.type] || e.type}</Tag></div>
              <div className="gov-title">{e.title}</div>
              <div>{e.impact && <><span className="gov-impact-dot" style={{ background: IMPACT_COLOR[e.impact] }}></span><span style={{ color: IMPACT_COLOR[e.impact], fontWeight: 600 }}>{e.impact}</span></>}</div>
              <div>{e.assertion && <Tag>{e.assertion}</Tag>}</div>
              <div><Tag tone={e.status === "executed" ? "ok" : "info"}>{e.status}</Tag></div>
              <div className="mono dim ta-r">{e.occurred_at ? new Date(e.occurred_at).toISOString().slice(0, 10) : "—"}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

Object.assign(window, { AuditTrailView, GovernanceView });
