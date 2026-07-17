// views_core.jsx — Overview, Live Feed, Risk Register
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

// ============ OVERVIEW ============
function OverviewView({ client }) {
  const findings = ADATA.FINDINGS.filter(f => f.client === client.id);
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach(f => counts[ADATA.severityOf(f.impact, f.likelihood)]++);
  const spark = [42, 48, 45, 53, 61, 58, 66, 62, 70, 64, 62];
  const [compare, setCompare] = useStateC(false);
  const cmp = ADATA.PERIOD_CMP;
  const dp = (q4, q3) => compare ? ((q4 - q3) / (q3 || 1) * 100) : null;

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div className="cmp-toggle">
          <button className={compare ? 'on' : ''} onClick={() => setCompare(c => !c)}>{compare ? 'Hide Q3 comparison' : 'Compare Q3 → Q4'}</button>
        </div>
      </div>
      <div className="grid-4">
        <Panel><Stat label="Treasury under audit" value={client.treasury} sub={`${client.wallets} wallets · ${client.contracts} contracts`} spark={spark} delta={dp(cmp.q4.treasury, cmp.q3.treasury)} /></Panel>
        <Panel><Stat label="Open findings" value={client.openFindings} tone="#e8652a" sub={`${counts.critical} critical · ${counts.high} high`} delta={compare ? ((cmp.q4.findings - cmp.q3.findings) / (cmp.q3.findings || 1) * 100) : null} /></Panel>
        <Panel><Stat label="Assertion coverage" value={(client.coverage * 100).toFixed(0) + "%"} sub="of mapped balances tested" delta={dp(cmp.q4.coverage, cmp.q3.coverage)} />
          <div style={{ marginTop: 10 }}><Meter pct={client.coverage} /></div>
        </Panel>
        <Panel className="risk-panel">
          <div className="risk-panel-inner">
            <div><div className="stat-label">Composite risk</div><div className="stat-sub" style={{ marginTop: 4 }}>impact × likelihood</div>{compare && <div className={"stat-delta " + (cmp.q4.riskScore > cmp.q3.riskScore ? "dn" : "up")} style={{marginTop:6,display:'inline-block'}}>Q3: {cmp.q3.riskScore} → Q4: {cmp.q4.riskScore}</div>}</div>
            <RiskRing score={client.riskScore} />
          </div>
        </Panel>
      </div>

      <div className="grid-2-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="shield" title="Severity distribution" sub="Open findings by composite severity" />
          <div className="sevdist">
            {["critical", "high", "medium", "low", "info"].map(s => {
              const c = ADATA.SEVERITY[s]; const n = counts[s];
              const max = Math.max(...Object.values(counts), 1);
              return (
                <div className="sevdist-row" key={s}>
                  <div className="sevdist-label" style={{ color: c.color }}>{c.label}</div>
                  <div className="sevdist-bar"><div style={{ width: (n / max * 100) + "%", background: c.color }} /></div>
                  <div className="sevdist-n">{n}</div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="scale" title="Assertion coverage" sub="Financial-statement assertions" />
          <div className="assert-list">
            {ADATA.ASSERTIONS.map(a => {
              const q3 = compare ? ADATA.PERIOD_CMP.assertionsQ3[a.name] : null;
              return (
                <div className="assert-row" key={a.name}>
                  <div className="assert-name">{a.name}</div>
                  <div className="assert-meter">
                    <Meter pct={a.pct} color={a.pct < 0.75 ? "#d9940e" : "var(--accent)"} />
                    {q3 != null && <div className="assert-q3-bar"><div style={{ width: (q3 * 100) + '%', background: a.pct < 0.75 ? '#d9940e' : 'var(--accent)' }} /></div>}
                  </div>
                  <div className="assert-pct">{(a.pct * 100).toFixed(0)}%{q3 != null && <span className="dim" style={{fontSize:10,marginLeft:4}}>({(q3*100).toFixed(0)}%)</span>}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="alert" title="Top open findings" sub={`${findings.length} findings in ${client.name}`}
          right={<Tag tone="info">View register →</Tag>} />
        <div className="flist">
          {findings.slice(0, 5).map(f => {
            const sev = ADATA.severityOf(f.impact, f.likelihood);
            return (
              <div className="flist-row" key={f.id}>
                <div className="flist-id mono">{f.id}</div>
                <SevBadge sev={sev} />
                <div className="flist-title">{f.title}<span className="flist-cat">{f.category}</span></div>
                <Tag>{f.assertion}</Tag>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ============ LIVE FEED ============
function LiveFeedView({ client }) {
  const [block, setBlock] = useStateC(21847392);
  const [rows, setRows] = useStateC(() => {
    let arr = []; for (let i = 0; i < 14; i++) arr.push(ADATA.makeTx(21847392 - Math.floor(i / 3))); return arr;
  });
  const [paused, setPaused] = useStateC(false);
  const [filter, setFilter] = useStateC("all");
  const blockRef = useRefC(21847392);

  useEffectC(() => {
    if (paused) return;
    const id = setInterval(() => {
      blockRef.current += (Math.random() < 0.4 ? 1 : 0);
      setBlock(blockRef.current);
      setRows(prev => [ADATA.makeTx(blockRef.current), ...prev].slice(0, 40));
    }, 1700);
    return () => clearInterval(id);
  }, [paused]);

  const anomalies = rows.filter(r => r.anomaly);
  const shown = filter === "anomaly" ? rows.filter(r => r.anomaly) : rows;

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Current block" value={"#" + block.toLocaleString()} sub={<span className="live-dot-row"><span className="live-dot" />{paused ? "paused" : "streaming"}</span>} /></Panel>
        <Panel><Stat label="Txns analyzed (session)" value={rows.length} sub="rolling window" /></Panel>
        <Panel><Stat label="Anomalies flagged" value={anomalies.length} tone="#e8652a" sub={`${(anomalies.length / rows.length * 100 || 0).toFixed(0)}% of stream`} /></Panel>
        <Panel><Stat label="Highest severity live" value={anomalies.some(a => a.severity === "critical") ? "Critical" : anomalies.length ? "High" : "—"} tone={anomalies.some(a => a.severity === "critical") ? "#dc3545" : "#e8652a"} /></Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="pulse" title="Real-time transaction stream" sub="Ethereum mainnet · client-tagged addresses"
          right={
            <div className="feed-ctrls">
              <button className={"seg " + (filter === "all" ? "on" : "")} onClick={() => setFilter("all")}>All</button>
              <button className={"seg " + (filter === "anomaly" ? "on" : "")} onClick={() => setFilter("anomaly")}>Anomalies</button>
              <button className="btn-sm" onClick={() => setPaused(p => !p)}>{paused ? "Resume" : "Pause"}</button>
            </div>
          } />
        <div className="feed-table">
          <div className="feed-th">
            <div>Block</div><div>Tx hash</div><div>Method</div><div>From → To</div><div className="ta-r">Value</div><div>Flag</div>
          </div>
          <div className="feed-body">
            {shown.map(r => (
              <div className={"feed-tr" + (r.anomaly ? " anom" : "")} key={r.id}>
                <div className="mono dim">#{r.block.toLocaleString()}</div>
                <div className="mono ellipsis">{r.hash.slice(0, 14)}…</div>
                <div><Tag>{r.method}</Tag></div>
                <div className="feed-flow"><EntityLabel entity={r.fromEntity} compact /><Icon path={ICONS.arrow} size={12} /><EntityLabel entity={r.toEntity} compact /></div>
                <div className="ta-r"><span className="mono">{r.valueEth} ETH</span><div className="feed-usd">${r.usd.toLocaleString()}</div></div>
                <div>{r.anomaly ? <SevBadge sev={r.severity}>{r.anomaly.type}</SevBadge> : <span className="ok-dot"><Icon path={ICONS.check} size={12} /></span>}</div>
                {r.anomaly && <div className="feed-reason">⚠ {r.anomaly.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ============ RISK REGISTER ============
function RiskRegisterView({ client }) {
  const findings = ADATA.FINDINGS.filter(f => f.client === client.id);
  const [sel, setSel] = useStateC(findings[0]?.id);
  const selected = findings.find(f => f.id === sel) || findings[0];

  // matrix cells
  const matrix = {};
  findings.forEach(f => { const k = f.impact + "-" + f.likelihood; (matrix[k] = matrix[k] || []).push(f); });

  return (
    <div className="view">
      <div className="grid-1-1">
        <Panel pad={false}>
          <PanelHead icon="grid" title="Impact × Likelihood matrix" sub="Composite severity = impact × likelihood" />
          <div className="matrix-wrap">
            <div className="matrix">
              <div className="m-corner" />
              {[1, 2, 3, 4, 5].map(l => <div className="m-coltop" key={"c" + l}>{l}</div>)}
              {[5, 4, 3, 2, 1].map(imp => (
                <React.Fragment key={"r" + imp}>
                  <div className="m-rowlbl">{imp}</div>
                  {[1, 2, 3, 4, 5].map(lk => {
                    const sev = ADATA.severityOf(imp, lk); const c = ADATA.SEVERITY[sev];
                    const cell = matrix[imp + "-" + lk] || [];
                    return (
                      <div className="m-cell" key={imp + "-" + lk} style={{ background: c.color + "26", borderColor: c.color + "40" }}
                        onClick={() => cell[0] && setSel(cell[0].id)}>
                        {cell.map(f => <span key={f.id} className="m-pin mono" style={{ background: c.color }} title={f.title}>{f.id.split("-")[1]}</span>)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="m-axis-x">Likelihood →</div>
            <div className="m-axis-y">Impact →</div>
          </div>
          <div className="m-legend">
            {["critical", "high", "medium", "low", "info"].map(s => (
              <span key={s} className="m-leg"><span className="m-leg-sw" style={{ background: ADATA.SEVERITY[s].color }} />{ADATA.SEVERITY[s].label}</span>
            ))}
          </div>
        </Panel>

        <Panel pad={false}>
          <PanelHead icon="alert" title="Finding detail" sub={selected?.id} />
          {selected && (
            <div className="detail">
              <div className="detail-top">
                <SevBadge sev={ADATA.severityOf(selected.impact, selected.likelihood)} />
                <Tag tone={selected.status === "open" ? "bad" : "warn"}>{selected.status}</Tag>
              </div>
              <div className="detail-title">{selected.title}</div>
              <div className="detail-score">
                <div><span className="ds-label">Impact</span><span className="ds-val">{selected.impact}<span className="ds-of">/5</span></span></div>
                <div className="ds-x">×</div>
                <div><span className="ds-label">Likelihood</span><span className="ds-val">{selected.likelihood}<span className="ds-of">/5</span></span></div>
                <div className="ds-eq">=</div>
                <div><span className="ds-label">Composite</span><span className="ds-val" style={{ color: ADATA.SEVERITY[ADATA.severityOf(selected.impact, selected.likelihood)].color }}>{selected.impact * selected.likelihood}</span></div>
              </div>
              <div className="detail-desc">{selected.desc}</div>
              <div className="detail-meta">
                <div><span className="dm-l">Category</span><span>{selected.category}</span></div>
                <div><span className="dm-l">Assertion</span><Tag tone="info">{selected.assertion}</Tag></div>
                <div><span className="dm-l">Detected</span><Mono dim>{selected.detected}</Mono></div>
                <div><span className="dm-l">Counterparty</span><EntityLabel address={selected.addr} /></div>
                <div><span className="dm-l">Evidence tx</span><AddrChip value={selected.txn} /></div>
              </div>
              {ADATA.EVIDENCE && ADATA.EVIDENCE[selected.id] && (
                <div className="evidence-sec">
                  <div className="evidence-head"><Icon path={ICONS.link} size={13} /> Linked evidence <span className="evidence-count">{ADATA.EVIDENCE[selected.id].length}</span></div>
                  <div className="evidence-items">
                    {ADATA.EVIDENCE[selected.id].map((ev, i) => (
                      <div className="evidence-item" key={i}>
                        <div className="evidence-item-top">
                          <Tag tone={ev.verified ? "ok" : "warn"}>{ev.verified ? "verified" : "unverified"}</Tag>
                          <Tag tone="neutral">{ev.type}</Tag>
                          <span className="mono">{ev.ref}</span>
                          {ev.block && <span className="dim" style={{fontSize:11}}>block #{ev.block.toLocaleString()}</span>}
                        </div>
                        <div className="evidence-desc">{ev.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="grid" title="Findings register" sub={`${findings.length} findings`} />
        <div className="reg-table">
          <div className="reg-th"><div>ID</div><div>Severity</div><div>Finding</div><div>Category</div><div>Assertion</div><div className="ta-r">Score</div></div>
          {findings.map(f => {
            const sev = ADATA.severityOf(f.impact, f.likelihood);
            return (
              <div className={"reg-tr" + (sel === f.id ? " on" : "")} key={f.id} onClick={() => setSel(f.id)}>
                <div className="mono">{f.id}</div>
                <div><SevBadge sev={sev} /></div>
                <div className="reg-title">{f.title}</div>
                <div className="dim">{f.category}</div>
                <div><Tag>{f.assertion}</Tag></div>
                <div className="ta-r mono" style={{ color: ADATA.SEVERITY[sev].color }}>{f.impact * f.likelihood}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

Object.assign(window, { OverviewView, LiveFeedView, RiskRegisterView });
