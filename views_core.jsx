// views_core.jsx — Overview, Live Feed, Risk Register (real API data)
const { useState: useStateC } = React;

function severityOf(impact, likelihood) {
  const s = impact * likelihood;
  if (s >= 20) return "critical";
  if (s >= 12) return "high";
  if (s >= 6) return "medium";
  if (s >= 3) return "low";
  return "info";
}
const SEVERITY = {
  critical: { label: "Critical", color: "#dc3545" },
  high: { label: "High", color: "#e8652a" },
  medium: { label: "Medium", color: "#d9940e" },
  low: { label: "Low", color: "#1a9d5e" },
  info: { label: "Informational", color: "#3b82f6" },
};
const ASSERTIONS = ["existence", "completeness", "rights_obligations", "valuation", "presentation", "cutoff", "classification"];
const ASSERTION_LABELS = {
  existence: "Existence", completeness: "Completeness", rights_obligations: "Rights & Obligations",
  valuation: "Valuation", presentation: "Presentation", cutoff: "Cut-off", classification: "Classification",
};

// ============ OVERVIEW ============
function OverviewView({ client }) {
  const { data: findings, loading, error, reload } = useApi(`/v1/engagements/${client.id}/findings`);
  const { data: signOffs } = useApi(`/v1/engagements/${client.id}/sign-offs`);

  if (loading) return <div className="view"><LoadingPanel label="Loading findings…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  (findings || []).forEach((f) => counts[f.severity]++);
  const openCount = (findings || []).filter((f) => f.status === "open").length;
  const maxCount = Math.max(...Object.values(counts), 1);

  const assertionCoverage = ASSERTIONS.map((a) => {
    const total = (signOffs || []).filter((s) => s.assertion === a).length;
    const approved = (signOffs || []).filter((s) => s.assertion === a && s.status === "approved").length;
    return { name: ASSERTION_LABELS[a], pct: total ? approved / total : null, total, approved };
  }).filter((a) => a.total > 0);

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Assertion coverage" value={client.coverage_pct != null ? (client.coverage_pct * 100).toFixed(0) + "%" : "—"} sub="of mapped balances tested" />
          {client.coverage_pct != null && <div style={{ marginTop: 10 }}><Meter pct={client.coverage_pct} /></div>}
        </Panel>
        <Panel><Stat label="Open findings" value={openCount} tone={openCount ? "#e8652a" : undefined} sub={`${counts.critical} critical · ${counts.high} high`} /></Panel>
        <Panel><Stat label="Total findings" value={(findings || []).length} sub="all statuses" /></Panel>
        <Panel className="risk-panel">
          <div className="risk-panel-inner">
            <div><div className="stat-label">Composite risk</div><div className="stat-sub" style={{ marginTop: 4 }}>impact × likelihood</div></div>
            {client.risk_score != null ? <RiskRing score={client.risk_score} /> : <span className="dim">not computed</span>}
          </div>
        </Panel>
      </div>

      <div className="grid-2-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="shield" title="Severity distribution" sub="Open findings by composite severity" />
          <div className="sevdist">
            {["critical", "high", "medium", "low", "info"].map((s) => (
              <div className="sevdist-row" key={s}>
                <div className="sevdist-label" style={{ color: SEVERITY[s].color }}>{SEVERITY[s].label}</div>
                <div className="sevdist-bar"><div style={{ width: (counts[s] / maxCount * 100) + "%", background: SEVERITY[s].color }} /></div>
                <div className="sevdist-n">{counts[s]}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="scale" title="Assertion sign-off coverage" sub="Approved vs. total sign-off rows" />
          {assertionCoverage.length === 0 ? (
            <div className="state-empty"><div className="dim sm">No sign-offs recorded yet for this engagement.</div></div>
          ) : (
            <div className="assert-list">
              {assertionCoverage.map((a) => (
                <div className="assert-row" key={a.name}>
                  <div className="assert-name">{a.name}</div>
                  <div className="assert-meter"><Meter pct={a.pct || 0} color={(a.pct || 0) < 0.75 ? "#d9940e" : "var(--accent)"} /></div>
                  <div className="assert-pct">{a.approved}/{a.total}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="alert" title="Findings" sub={`${(findings || []).length} findings in ${client.name}`} />
        {(!findings || findings.length === 0) ? (
          <EmptyPanel title="No findings yet" sub="Create one via POST /v1/engagements/:id/findings." />
        ) : (
          <div className="flist">
            {findings.slice(0, 8).map((f) => (
              <div className="flist-row" key={f.id}>
                <div className="flist-id mono">{f.id}</div>
                <SevBadge sev={f.severity}>{SEVERITY[f.severity].label}</SevBadge>
                <div className="flist-title">{f.title}<span className="flist-cat">{f.category}</span></div>
                <Tag>{ASSERTION_LABELS[f.assertion] || f.assertion}</Tag>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============ LIVE FEED ============
// Backed by GET /v1/engagements/:id/feed/stream (SSE): a backlog on
// connect, then live pushes as block-sync-polling matches new transactions
// against this engagement's wallets_contracts rows.
function shortHash(v) { return v ? v.slice(0, 8) + "…" + v.slice(-6) : "—"; }
function weiToEth(w) {
  try {
    const n = Number(BigInt(w) / 10n ** 10n) / 1e8; // 8 sig figs of precision, avoids float overflow on large wei
    return n;
  } catch { return 0; }
}
function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  return Math.floor(s / 3600) + "h ago";
}

const CHAINS = ["ethereum", "arbitrum", "polygon", "optimism", "base"];

function TrackWalletForm({ client, onAdded }) {
  const [address, setAddress] = useStateC("");
  const [chain, setChain] = useStateC("arbitrum");
  const [kind, setKind] = useStateC("eoa");
  const [error, setError] = useStateC(null);
  const [busy, setBusy] = useStateC(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/v1/engagements/${client.id}/wallets`, { method: "POST", body: { address, chain, kind } });
      setAddress("");
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="onboard-form"
      onSubmit={submit}
      style={{ flexDirection: "row", alignItems: "center", width: "auto", maxWidth: "none", padding: "12px 16px", borderBottom: "1px solid var(--line)", margin: 0 }}
    >
      <input placeholder="0x… wallet or contract address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ flex: 1, minWidth: 260 }} />
      <select value={chain} onChange={(e) => setChain(e.target.value)}>
        {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="eoa">EOA</option>
        <option value="multisig">Multisig</option>
        <option value="contract">Contract</option>
      </select>
      <button className="btn-sm" type="submit" disabled={busy || !address}>{busy ? "Adding…" : "Track wallet"}</button>
      {error && <span className="dim sm" style={{ color: "var(--high)" }}>{error}</span>}
    </form>
  );
}

function LiveFeedView({ client }) {
  const { events, status } = useLiveFeed(client.id);
  const { data: wallets, reload: reloadWallets } = useApi(`/v1/engagements/${client.id}/wallets`);

  return (
    <div className="view">
      <Panel pad={false} style={{ marginBottom: 14 }}>
        <PanelHead icon="server" title="Tracked wallets" sub={`${(wallets || []).length} address${(wallets || []).length === 1 ? "" : "es"} on this engagement — only wallets on the chain the worker's RPC endpoint serves will show live activity`} />
        <TrackWalletForm client={client} onAdded={reloadWallets} />
        {(wallets || []).length > 0 && (
          <div style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {wallets.map((w) => (
              <Tag key={w.id} tone="neutral">{w.chain} · <span className="mono">{w.address.slice(0, 6)}…{w.address.slice(-4)}</span></Tag>
            ))}
          </div>
        )}
      </Panel>
      <Panel pad={false}>
        <PanelHead
          icon="pulse"
          title="Real-time transaction feed"
          sub="Transactions touching this engagement's tracked wallets, as blocks land"
          right={
            <div className="live-dot-row">
              {status === "open" && <><span className="live-dot" /><span className="dim sm">Live</span></>}
              {status === "connecting" && <span className="dim sm">Connecting…</span>}
              {status === "closed" && <span className="dim sm">Disconnected</span>}
              {status === "error" && <span className="dim sm" style={{ color: "var(--high)" }}>Connection error</span>}
            </div>
          }
        />
        {events.length === 0 ? (
          <EmptyPanel
            title={status === "open" ? "No transactions yet" : status === "error" ? "Couldn't connect to the feed" : "Waiting for the first event…"}
            sub="New transactions touching a tracked wallet appear here as they're detected — nothing to backfill on a fresh engagement."
          />
        ) : (
          <div className="feed-table">
            <div className="feed-th">
              <div>Block</div><div>Tx</div><div>Direction</div><div>Flow</div><div>Value</div><div>Detected</div>
            </div>
            <div className="feed-body">
              {events.map((e) => (
                <div className={"feed-tr" + (e.is_new_counterparty ? " anom" : "")} key={e.id}>
                  <div className="mono dim">{e.block_number}</div>
                  <div><AddrChip value={e.tx_hash} /></div>
                  <div><Tag tone={e.direction === "out" ? "warn" : "ok"}>{e.direction === "out" ? "Outbound" : "Inbound"}</Tag></div>
                  <div className="feed-flow">
                    <AddrChip value={e.from_address} />
                    <Icon path={ICONS.arrow} size={12} />
                    {e.to_address ? <AddrChip value={e.to_address} /> : <span className="dim">contract creation</span>}
                  </div>
                  <div className="mono">{weiToEth(e.value_wei).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH</div>
                  <div className="feed-usd"><SevBadge sev={e.severity} /> <span style={{ marginLeft: 6 }}>{timeAgo(e.detected_at)}</span></div>
                  {e.is_new_counterparty && <div className="feed-reason">First transaction with this counterparty</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============ RISK REGISTER ============
function RiskRegisterView({ client }) {
  const { data: findings, loading, error, reload } = useApi(`/v1/engagements/${client.id}/findings`);
  const [sel, setSel] = useStateC(null);

  if (loading) return <div className="view"><LoadingPanel label="Loading findings…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = findings || [];
  const selected = list.find((f) => f.id === sel) || list[0];
  const matrix = {};
  list.forEach((f) => { const k = f.impact + "-" + f.likelihood; (matrix[k] = matrix[k] || []).push(f); });

  if (list.length === 0) {
    return <div className="view"><EmptyPanel title="No findings yet" sub={`This engagement has no findings. Create one via POST /v1/engagements/${client.id}/findings.`} /></div>;
  }

  return (
    <div className="view">
      <div className="grid-1-1">
        <Panel pad={false}>
          <PanelHead icon="grid" title="Impact × Likelihood matrix" sub="Composite severity = impact × likelihood" />
          <div className="matrix-wrap">
            <div className="matrix">
              <div className="m-corner" />
              {[1, 2, 3, 4, 5].map((l) => <div className="m-coltop" key={"c" + l}>{l}</div>)}
              {[5, 4, 3, 2, 1].map((imp) => (
                <React.Fragment key={"r" + imp}>
                  <div className="m-rowlbl">{imp}</div>
                  {[1, 2, 3, 4, 5].map((lk) => {
                    const sev = severityOf(imp, lk);
                    const c = SEVERITY[sev];
                    const cell = matrix[imp + "-" + lk] || [];
                    return (
                      <div className="m-cell" key={imp + "-" + lk} style={{ background: c.color + "26", borderColor: c.color + "40" }}
                        onClick={() => cell[0] && setSel(cell[0].id)}>
                        {cell.map((f) => <span key={f.id} className="m-pin mono" style={{ background: c.color }} title={f.title}>{f.id.slice(0, 4)}</span>)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="m-axis-x">Likelihood →</div>
            <div className="m-axis-y">Impact →</div>
          </div>
        </Panel>

        <Panel pad={false}>
          <PanelHead icon="alert" title="Finding detail" sub={selected?.id} />
          {selected && (
            <div className="detail">
              <div className="detail-top">
                <SevBadge sev={selected.severity}>{SEVERITY[selected.severity].label}</SevBadge>
                <Tag tone={selected.status === "open" ? "bad" : "warn"}>{selected.status}</Tag>
              </div>
              <div className="detail-title">{selected.title}</div>
              <div className="detail-score">
                <div><span className="ds-label">Impact</span><span className="ds-val">{selected.impact}<span className="ds-of">/5</span></span></div>
                <div className="ds-x">×</div>
                <div><span className="ds-label">Likelihood</span><span className="ds-val">{selected.likelihood}<span className="ds-of">/5</span></span></div>
                <div className="ds-eq">=</div>
                <div><span className="ds-label">Composite</span><span className="ds-val" style={{ color: SEVERITY[selected.severity].color }}>{selected.impact * selected.likelihood}</span></div>
              </div>
              <div className="detail-desc">{selected.description}</div>
              <div className="detail-meta">
                <div><span className="dm-l">Category</span><span>{selected.category}</span></div>
                <div><span className="dm-l">Assertion</span><Tag tone="info">{ASSERTION_LABELS[selected.assertion] || selected.assertion}</Tag></div>
                <div><span className="dm-l">Detected</span><Mono dim>{new Date(selected.detected_at).toISOString().slice(0, 16).replace("T", " ")} UTC</Mono></div>
                {selected.tx_hash && <div><span className="dm-l">Evidence tx</span><AddrChip value={selected.tx_hash} /></div>}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="grid" title="Findings register" sub={`${list.length} findings`} />
        <div className="reg-table">
          <div className="reg-th"><div>ID</div><div>Severity</div><div>Finding</div><div>Category</div><div>Assertion</div><div className="ta-r">Score</div></div>
          {list.map((f) => (
            <div className={"reg-tr" + (selected?.id === f.id ? " on" : "")} key={f.id} onClick={() => setSel(f.id)}>
              <div className="mono">{f.id}</div>
              <div><SevBadge sev={f.severity}>{SEVERITY[f.severity].label}</SevBadge></div>
              <div className="reg-title">{f.title}</div>
              <div className="dim">{f.category}</div>
              <div><Tag>{ASSERTION_LABELS[f.assertion] || f.assertion}</Tag></div>
              <div className="ta-r mono" style={{ color: SEVERITY[f.severity].color }}>{f.impact * f.likelihood}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

Object.assign(window, { OverviewView, LiveFeedView, RiskRegisterView });
