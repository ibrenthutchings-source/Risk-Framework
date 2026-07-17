// views_audit.jsx — Audit Trail + Governance views
const { useState: useStateAT } = React;

// ============ AUDIT TRAIL ============
function AuditTrailView({ client }) {
  const trail = ADATA.AUDIT_TRAIL;
  const signoffs = ADATA.SIGN_OFFS;
  const approved = signoffs.filter(s => s.status === "approved").length;
  const pending = signoffs.filter(s => s.status !== "approved").length;
  const [filter, setFilter] = useStateAT("all");

  const typeColor = { finding: "#dc3545", evidence: "#8b7cf0", query: "#0e7c6b", signoff: "#1a9d5e", alert: "#e8652a", admin: "#3b82f6" };
  const statusTone = { open: "bad", documented: "info", flagged: "warn", pending: "neutral", approved: "ok", pass: "ok", escalated: "bad", alert: "warn", started: "info", "in-review": "warn" };
  const shown = filter === "all" ? trail : trail.filter(t => t.type === filter);

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Audit activities" value={trail.length} sub="this engagement" /></Panel>
        <Panel><Stat label="Sign-offs approved" value={approved + "/" + signoffs.length} tone="#1a9d5e" sub="assertion-level approval" /></Panel>
        <Panel><Stat label="Pending review" value={pending} tone="#e8652a" sub="awaiting sign-off" /></Panel>
        <Panel><Stat label="Team members" value="3" sub="1 partner · 1 lead · 1 staff" /></Panel>
      </div>

      <div className="grid-2-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="clock" title="Activity timeline" sub="Chronological audit trail"
            right={
              <div className="feed-ctrls">
                {["all", "finding", "signoff", "query", "alert"].map(f => (
                  <button key={f} className={"seg " + (filter === f ? "on" : "")} onClick={() => setFilter(f)}>{f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}</button>
                ))}
              </div>
            } />
          <div className="trail-list">
            {shown.map((t, i) => (
              <div className="trail-row" key={t.id}>
                <div className="trail-line">
                  <div className="trail-dot" style={{ background: typeColor[t.type] || "#5b6776" }} />
                  {i < shown.length - 1 && <div className="trail-stem" />}
                </div>
                <div className="trail-body">
                  <div className="trail-top">
                    <span className="trail-action">{t.action}</span>
                    <Tag tone={statusTone[t.status] || "neutral"}>{t.status}</Tag>
                  </div>
                  <div className="trail-target">
                    <Tag tone="info">{t.target}</Tag>
                    <span className="trail-actor">{t.actor} <span className="dim">· {t.role}</span></span>
                  </div>
                  <div className="trail-ts mono dim">{t.ts}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel pad={false}>
          <PanelHead icon="check" title="Assertion sign-offs" sub="Review & approval matrix" />
          <div className="signoff-list">
            {signoffs.map(s => {
              const ic = s.status === "approved" ? ICONS.check : s.status === "in-review" ? ICONS.clock : ICONS.dot;
              const icColor = s.status === "approved" ? "#1a9d5e" : s.status === "in-review" ? "#e8652a" : "#5b6776";
              return (
                <div className={"signoff-row " + s.status} key={s.assertion}>
                  <div className="signoff-top">
                    <Icon path={ic} size={15} style={{ color: icColor }} />
                    <div className="signoff-assertion">{s.assertion}</div>
                    <Tag tone={s.status === "approved" ? "ok" : s.status === "in-review" ? "warn" : "neutral"}>{s.status}</Tag>
                  </div>
                  <div className="signoff-meta">
                    <span className="signoff-av" style={{ borderColor: icColor }}>{s.reviewer.split(" ").map(w => w[0]).join("")}</span>
                    <span className="signoff-reviewer">{s.reviewer}<span className="dim"> · {s.role}</span></span>
                    {s.date && <span className="signoff-date mono dim">{s.date}</span>}
                  </div>
                  <div className="signoff-note dim">{s.note}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ============ GOVERNANCE ============
function GovernanceView({ client }) {
  const events = ADATA.GOVERNANCE;
  const active = events.filter(e => e.status === "active");
  const highImpact = events.filter(e => e.impact === "high");
  const impactColor = { high: "#dc3545", medium: "#e8652a", low: "#1a9d5e" };
  const typeLabel = { proposal: "Proposal", parameter: "Parameter Δ", timelock: "Timelock" };
  const fmtV = (n) => (n / 1e6).toFixed(1) + "M";

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Governance events" value={events.length} sub="proposals + parameters" /></Panel>
        <Panel><Stat label="Active proposals" value={active.length} tone="#3b82f6" sub="voting in progress" /></Panel>
        <Panel><Stat label="Parameter changes" value={events.filter(e => e.type === "parameter").length} sub="executed this period" /></Panel>
        <Panel><Stat label="High-impact events" value={highImpact.length} tone="#dc3545" sub="affect financial assertions" /></Panel>
      </div>

      {active.length > 0 && (
        <Panel pad={false} style={{ marginTop: 14 }}>
          <PanelHead icon="layers" title="Active proposals" sub="Currently in voting period" />
          <div className="gov-active">
            {active.map(e => {
              const total = e.votes.f + e.votes.a;
              const forPct = total ? (e.votes.f / total * 100) : 0;
              const quorumPct = total ? Math.min(total / e.votes.q * 100, 100) : 0;
              return (
                <div className="gov-proposal" key={e.id}>
                  <div className="gov-prop-head">
                    <span className="gov-prop-id mono">{e.id}</span>
                    <span className="gov-prop-title">{e.title}</span>
                    <Tag tone="info">{e.assertion}</Tag>
                    <span className="gov-impact" style={{ color: impactColor[e.impact] }}>{e.impact}</span>
                  </div>
                  <div className="gov-votes">
                    <div className="gov-vote-bar">
                      <div className="gov-for" style={{ width: forPct + "%" }}></div>
                    </div>
                    <div className="gov-vote-labels">
                      <span style={{ color: "#1a9d5e" }}>For {fmtV(e.votes.f)} ({forPct.toFixed(0)}%)</span>
                      <span style={{ color: "#dc3545" }}>Against {fmtV(e.votes.a)}</span>
                    </div>
                    <div className="gov-quorum">
                      <span className="dim">Quorum</span>
                      <div className="gov-quorum-bar"><div style={{ width: quorumPct + "%" }}></div></div>
                      <span className="mono">{quorumPct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="gov-prop-meta mono dim">{e.date} · block #{e.block.toLocaleString()} · by {e.actor}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="clock" title="Event log" sub="All governance activity this period" />
        <div className="gov-log">
          <div className="gov-th"><div>ID</div><div>Type</div><div>Event</div><div>Impact</div><div>Assertion</div><div>Status</div><div className="ta-r">Date</div></div>
          {events.map(e => (
            <div className="gov-tr" key={e.id}>
              <div className="mono dim">{e.id}</div>
              <div><Tag tone={e.type === "proposal" ? "info" : e.type === "parameter" ? "warn" : "neutral"}>{typeLabel[e.type]}</Tag></div>
              <div className="gov-title">{e.title}</div>
              <div><span className="gov-impact-dot" style={{ background: impactColor[e.impact] }}></span><span style={{ color: impactColor[e.impact], fontWeight: 600 }}>{e.impact}</span></div>
              <div><Tag>{e.assertion}</Tag></div>
              <div><Tag tone={e.status === "executed" ? "ok" : "info"}>{e.status}</Tag></div>
              <div className="mono dim ta-r">{e.date}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

Object.assign(window, { AuditTrailView, GovernanceView });
