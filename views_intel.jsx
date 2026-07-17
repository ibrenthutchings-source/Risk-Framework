// views_intel.jsx — Counterparty Intel, Fund-Flow Trace, Audit Queries, Alerts
const { useState: useStateV2 } = React;

// ============ COUNTERPARTY INTELLIGENCE ============
function CounterpartyView({ client }) {
  const exp = ADATA.EXPOSURE;
  const maxFlow = Math.max(...exp.map(e => e.flowsUsd));
  const riskyUsd = exp.filter(e => e.risk === "critical").reduce((a, e) => a + e.flowsUsd, 0);
  const totalUsd = exp.reduce((a, e) => a + e.flowsUsd, 0);
  const fmt = (n) => n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : "$" + (n / 1e3).toFixed(0) + "K";
  const [typeFilter, setTypeFilter] = useStateV2("all");
  const ents = typeFilter === "all" ? ADATA.ENTITIES.filter(e => e.type !== "client") : ADATA.ENTITIES.filter(e => e.type === typeFilter);

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Labeled counterparties" value={ADATA.ENTITIES.length} sub="resolved to entities" /></Panel>
        <Panel><Stat label="Mixer + sanctioned exposure" value={fmt(riskyUsd)} tone="#dc3545" sub="requires documentation" /></Panel>
        <Panel><Stat label="Risky-flow share" value={(riskyUsd / totalUsd * 100).toFixed(1) + "%"} tone="#e8652a" sub="of total counterparty flow" /></Panel>
        <Panel><Stat label="Smart-money inflow" value={fmt(6100000)} tone="#c49000" sub="44 transfers" /></Panel>
      </div>

      <div className="grid-2-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="pulse" title="Counterparty exposure by entity type" sub="Flow volume this period · entity-resolved" />
          <div className="exp-list">
            {exp.sort((a, b) => b.flowsUsd - a.flowsUsd).map(e => {
              const t = ADATA.ENTITY_TYPES[e.type];
              return (
                <div className="exp-row" key={e.type}>
                  <div className="exp-lbl"><EntityDot type={e.type} /><span>{t.label}</span></div>
                  <div className="exp-bar"><div style={{ width: (e.flowsUsd / maxFlow * 100) + "%", background: t.color }} /></div>
                  <div className="exp-val mono">{fmt(e.flowsUsd)}</div>
                  <div className="exp-n dim">{e.count} tx</div>
                  {e.risk === "critical" ? <SevBadge sev="critical" /> : e.risk === "med" ? <SevBadge sev="medium" /> : <span className="exp-ok"><Icon path={ICONS.check} size={12} /></span>}
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="shield" title="Flagged exposure" sub="Reportable counterparties" />
          <div className="flag-exp">
            {ADATA.ENTITIES.filter(e => e.type === "mixer" || e.type === "sanctioned").map(e => (
              <button className="flag-card" key={e.id} onClick={() => openProfiler(e)}>
                <div className="flag-top"><EntityDot type={e.type} size={10} /><span className="flag-name">{e.name}</span><SevBadge sev="critical" /></div>
                <div className="flag-note">{e.note}</div>
                <div className="flag-addr mono">{ADATA.shortAddr(e.address)}</div>
              </button>
            ))}
            <div className="flag-hint"><Icon path={ICONS.alert} size={13} /> Click any entity to open its wallet profile.</div>
          </div>
        </Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="grid" title="Entity label database" sub={`${ents.length} entities`}
          right={
            <div className="feed-ctrls">
              {["all", "cex", "defi", "smart", "mixer", "sanctioned"].map(f =>
                <button key={f} className={"seg " + (typeFilter === f ? "on" : "")} onClick={() => setTypeFilter(f)}>{f === "all" ? "All" : ADATA.ENTITY_TYPES[f].short}</button>)}
            </div>
          } />
        <div className="ent-table">
          <div className="ent-th"><div>Entity</div><div>Type</div><div>Address</div><div className="ta-r">Balance</div><div className="ta-r">Age</div><div>Risk</div><div>Tags</div></div>
          {ents.map(e => {
            const t = ADATA.ENTITY_TYPES[e.type];
            return (
              <div className="ent-tr" key={e.id} onClick={() => openProfiler(e)}>
                <div className="ent-cell-name"><EntityDot type={e.type} /><span>{e.name}</span></div>
                <div><span className="ent-type" style={{ color: t.color, borderColor: t.color + "44", background: t.color + "16" }}>{t.short}</span></div>
                <div className="mono dim">{ADATA.shortAddr(e.address)}</div>
                <div className="ta-r mono">{e.balanceUsd ? (e.balanceUsd >= 1e6 ? "$" + (e.balanceUsd / 1e6).toFixed(1) + "M" : "$" + (e.balanceUsd / 1e3).toFixed(0) + "K") : "—"}</div>
                <div className="ta-r mono dim">{e.ageDays}d</div>
                <div>{e.risk ? <Tag tone={e.risk === "critical" || e.risk === "high" ? "bad" : e.risk === "med" ? "warn" : "neutral"}>{e.risk}</Tag> : <span className="exp-ok"><Icon path={ICONS.check} size={12} /></span>}</div>
                <div className="ent-tags">{e.tags.slice(0, 2).map(tg => <span key={tg} className="ent-minitag">{tg}</span>)}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ============ FUND-FLOW TRACE ============
function FlowFocus({ data, id, onSelect }) {
  const e = ADATA.ENTITY_BY_ID[id];
  const t = ADATA.ENTITY_TYPES[e ? e.type : "unknown"] || ADATA.ENTITY_TYPES.unknown;
  const fmt = (n) => "$" + (n / 1e6).toFixed(2) + "M";
  const inLinks = data.links.filter(l => l.t === id);
  const outLinks = data.links.filter(l => l.s === id);
  const inTot = inLinks.reduce((a, l) => a + l.amt, 0);
  const outTot = outLinks.reduce((a, l) => a + l.amt, 0);
  const net = inTot - outTot;
  const role = inLinks.length && outLinks.length ? "Pass-through" : outLinks.length ? "Source" : "Destination";
  const worst = [...inLinks, ...outLinks].reduce((w, l) => {
    const order = { critical: 4, high: 3, med: 2, low: 1 };
    return (order[l.risk] || 0) > (order[w] || 0) ? l.risk : w;
  }, null);
  return (
    <div className="ff-focus">
      <div className="ff-focus-head">
        <EntityDot type={e ? e.type : "unknown"} size={11} />
        <div className="ff-focus-name">{e ? e.name : id}</div>
        <span className="ff-role" style={{ color: t.color, background: t.color + "1c", border: "1px solid " + t.color + "44" }}>{role}</span>
      </div>
      {e && e.note && <div className="ff-focus-note">{e.note}</div>}

      <div className="ff-iostats">
        <div className="ff-iostat"><div className="ds-label">Inflow</div><div className="ff-io-val" style={{ color: "#1a9d5e" }}>{inLinks.length ? fmt(inTot) : "—"}</div></div>
        <div className="ff-iostat"><div className="ds-label">Outflow</div><div className="ff-io-val" style={{ color: "#e8652a" }}>{outLinks.length ? fmt(outTot) : "—"}</div></div>
        <div className="ff-iostat"><div className="ds-label">Net</div><div className="ff-io-val">{(net >= 0 ? "+" : "−") + fmt(Math.abs(net)).slice(1)}</div></div>
      </div>

      {inLinks.length > 0 && <>
        <div className="ff-io-sec"><Icon path={ICONS.arrow} size={12} /> Receives from</div>
        <div className="ff-io-list">
          {inLinks.map((l, i) => (
            <div className="ff-io-row" key={"in" + i} onClick={() => onSelect(l.s)} style={{ cursor: "pointer" }}>
              <EntityLabel entity={ADATA.ENTITY_BY_ID[l.s]} compact />
              <span className="ff-io-amt" style={{ color: ADATA.SEVERITY[l.risk] ? ADATA.SEVERITY[l.risk].color : "#1a9d5e" }}>{fmt(l.amt)}</span>
            </div>
          ))}
        </div>
      </>}
      {outLinks.length > 0 && <>
        <div className="ff-io-sec"><Icon path={ICONS.arrow} size={12} /> Sends to</div>
        <div className="ff-io-list">
          {outLinks.map((l, i) => (
            <div className="ff-io-row" key={"out" + i} onClick={() => onSelect(l.t)} style={{ cursor: "pointer" }}>
              <EntityLabel entity={ADATA.ENTITY_BY_ID[l.t]} compact />
              <span className="ff-io-amt" style={{ color: ADATA.SEVERITY[l.risk] ? ADATA.SEVERITY[l.risk].color : "#1a9d5e" }}>{fmt(l.amt)}</span>
            </div>
          ))}
        </div>
      </>}

      {(worst === "critical" || worst === "high") &&
        <div className="cd-note"><Icon path={ICONS.alert} size={14} /><span>A hop on this entity's path is rated <b style={{ textTransform: "capitalize" }}>{worst}</b>. Source-of-funds documentation required before recognition.</span></div>}

      <div className="ff-focus-btns">
        {e && <button className="btn-export" onClick={() => openProfiler(e)}><Icon path={ICONS.search} size={14} /> Open full profile</button>}
      </div>
    </div>
  );
}

function FundFlowView({ client }) {
  const [scenario, setScenario] = useStateV2("mixer");
  const [selected, setSelected] = useStateV2(null);
  const [hover, setHover] = useStateV2(null);
  const data = ADATA.FUND_FLOWS[scenario];
  const total = data.links.reduce((a, l) => a + l.amt, 0);
  const fmt = (n) => "$" + (n / 1e6).toFixed(2) + "M";
  const activeId = hover || selected;
  React.useEffect(() => { setSelected(null); setHover(null); }, [scenario]);
  return (
    <div className="view">
      <div className="ff-head">
        <div className="feed-ctrls">
          <button className={"seg " + (scenario === "mixer" ? "on" : "")} onClick={() => setScenario("mixer")}>Mixer inflow trace</button>
          <button className={"seg " + (scenario === "treasury" ? "on" : "")} onClick={() => setScenario("treasury")}>Treasury use-of-funds</button>
        </div>
      </div>
      <div className="grid-2-1">
        <Panel pad={false}>
          <PanelHead icon="pulse" title={data.label} sub={data.desc} />
          <div className="sankey-wrap">
            <Sankey data={data} activeId={activeId} selectedId={selected} onHover={setHover} onSelect={setSelected} />
          </div>
          <div className="sankey-legend">
            {[...new Set(data.nodes.map(n => n.type))].map(ty => (
              <span key={ty} className="m-leg"><EntityDot type={ty} /> {ADATA.ENTITY_TYPES[ty].label}</span>
            ))}
          </div>
        </Panel>
        <Panel pad={false}>
          {selected ? (
            <React.Fragment>
              <PanelHead icon="search" title="Entity flow detail" sub="Inflows, outflows & direct counterparties"
                right={<button className="ff-clear" onClick={() => setSelected(null)}>Clear</button>} />
              <FlowFocus data={data} id={selected} onSelect={setSelected} />
            </React.Fragment>
          ) : (
            <React.Fragment>
              <PanelHead icon="scale" title="Trace summary" sub="Source & use of funds" />
              <div className="ff-summary">
                <div className="ff-stat"><div className="ds-label">Total traced</div><div className="ms-big">{fmt(total)}</div></div>
                <div className="ff-rows">
                  {data.links.map((l, i) => (
                    <div className="ff-link" key={i} onClick={() => setSelected(l.t)} onMouseEnter={() => setHover(l.t)} onMouseLeave={() => setHover(null)}>
                      <EntityLabel entity={ADATA.ENTITY_BY_ID[l.s]} compact />
                      <Icon path={ICONS.arrow} size={13} />
                      <EntityLabel entity={ADATA.ENTITY_BY_ID[l.t]} compact />
                      <span className="ff-amt mono" style={{ color: ADATA.SEVERITY[l.risk]?.color || "#1a9d5e" }}>{fmt(l.amt)}</span>
                    </div>
                  ))}
                </div>
                {scenario === "mixer" &&
                  <div className="cd-note"><Icon path={ICONS.alert} size={14} /><span>Inflow traces 2 hops from a tagged mixer. Source-of-funds documentation required before recognition — links to finding <b>AUR-03</b> (Completeness).</span></div>}
                {scenario === "treasury" &&
                  <div className="infra-note"><Icon path={ICONS.check} size={14} /><span>All destinations resolve to known DeFi / exchange / MM entities. No unlabeled or sanctioned exposure in outflows.</span></div>}
                <div className="ff-hint"><Icon path={ICONS.pulse} size={13} /><span>Hover or click any wallet to trace its flows; click a row to focus an entity.</span></div>
              </div>
            </React.Fragment>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ============ AUDIT QUERY LIBRARY ============
function QueriesView({ client }) {
  const qs = ADATA.AUDIT_QUERIES;
  const [sel, setSel] = useStateV2(qs[0].id);
  const [running, setRunning] = useStateV2(false);
  const q = qs.find(x => x.id === sel);
  const statusTone = { pass: "ok", flag: "warn", fail: "bad" };
  const statusLabel = { pass: "Pass", flag: "Flagged", fail: "Fail" };
  const run = () => { setRunning(true); setTimeout(() => setRunning(false), 900); };

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Saved procedures" value={qs.length} sub="reusable across engagements" /></Panel>
        <Panel><Stat label="Flagged" value={qs.filter(x => x.status === "flag").length} tone="#d9940e" sub="require follow-up" /></Panel>
        <Panel><Stat label="Passing" value={qs.filter(x => x.status === "pass").length} tone="#1a9d5e" sub="no exceptions" /></Panel>
        <Panel><Stat label="Assertions covered" value={new Set(qs.map(x => x.assertion)).size} sub="of 6 mapped" /></Panel>
      </div>

      <div className="grid-1-2" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="grid" title="Procedure library" sub="Versioned audit queries" />
          <div className="q-list">
            {qs.map(x => (
              <div className={"q-row" + (sel === x.id ? " on" : "")} key={x.id} onClick={() => setSel(x.id)}>
                <div className="q-row-top"><span className="mono q-id">{x.id}</span><Tag tone={statusTone[x.status]}>{statusLabel[x.status]}</Tag></div>
                <div className="q-name">{x.name}</div>
                <div className="q-meta"><Tag tone="info">{x.assertion}</Tag><span className="dim mono">{x.rows} rows</span></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="contract" title={q.name} sub={`${q.id} · last run ${q.lastRun}`}
            right={<button className="btn-run" onClick={run}>{running ? "Running…" : "▶ Run query"}</button>} />
          <div className="q-detail">
            <div className="q-sql">
              <div className="q-sql-head"><span className="mono dim">audit_procedure.sql</span><Tag tone="info">{q.assertion}</Tag></div>
              <pre className="mono">{q.sql}</pre>
            </div>
            <div className="q-results-head">
              <span>Results</span>
              {running ? <span className="dim sm">executing against erigon-mainnet-04…</span> : <Tag tone={statusTone[q.status]}>{q.rows} rows · {statusLabel[q.status]}</Tag>}
            </div>
            <div className={"q-results" + (running ? " loading" : "")}>
              <table>
                <thead><tr>{q.cols.map(c => <th key={c} className="mono">{c}</th>)}</tr></thead>
                <tbody>
                  {q.results.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="mono">{cell}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      </div>
      {typeof DunePanel !== "undefined" && <DunePanel />}
    </div>
  );
}

// ============ ALERTS ENGINE ============
function AlertsView({ client }) {
  const [rules, setRules] = useStateV2(ADATA.ALERT_RULES.map(r => ({ ...r })));
  const toggle = (id) => setRules(rs => rs.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const setThresh = (id, v) => setRules(rs => rs.map(r => r.id === id ? { ...r, threshold: v } : r));
  const active = rules.filter(r => r.enabled).length;
  const triggered = rules.reduce((a, r) => a + (r.enabled ? r.triggered : 0), 0);
  const critTrig = rules.filter(r => r.enabled && r.severity === "critical").reduce((a, r) => a + r.triggered, 0);
  const sevTone = { critical: "bad", high: "warn", medium: "neutral" };
  const fmtT = (r) => r.threshold >= 1000 ? "$" + (r.threshold / 1000).toFixed(0) + "K" : r.threshold + (r.id === "AR-4" ? " days" : r.id === "AR-7" ? " min" : "");

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Active rules" value={`${active}/${rules.length}`} sub="continuous monitoring" /></Panel>
        <Panel><Stat label="Triggered (24h)" value={triggered} tone="#e8652a" sub="across active rules" /></Panel>
        <Panel><Stat label="Critical triggered" value={critTrig} tone="#dc3545" sub="immediate escalation" /></Panel>
        <Panel><Stat label="Channels" value="4" sub="Pager · Email · Slack" /></Panel>
      </div>

      <div className="grid-2-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="shield" title="Alert rules" sub="Toggle rules and tune thresholds — applies to the live stream" />
          <div className="rule-list">
            {rules.map(r => (
              <div className={"rule-row" + (r.enabled ? "" : " off")} key={r.id}>
                <Switch on={r.enabled} onChange={() => toggle(r.id)} color={ADATA.SEVERITY[r.severity].color} />
                <div className="rule-main">
                  <div className="rule-name">{r.name} <Tag tone={sevTone[r.severity]}>{r.severity}</Tag></div>
                  <div className="rule-cond mono">{r.condition}</div>
                </div>
                {r.threshold > 0 ? (
                  <div className="rule-thresh">
                    <input type="range" min={r.id === "AR-4" ? 1 : r.id === "AR-7" ? 15 : 100000}
                      max={r.id === "AR-4" ? 30 : r.id === "AR-7" ? 240 : 2000000}
                      step={r.id === "AR-4" ? 1 : r.id === "AR-7" ? 15 : 50000}
                      value={r.threshold} disabled={!r.enabled}
                      onChange={(e) => setThresh(r.id, +e.target.value)} />
                    <span className="mono rule-tval">{fmtT(r)}</span>
                  </div>
                ) : <div className="rule-thresh dim sm">no threshold</div>}
                <div className="rule-channel dim sm">{r.channel}</div>
                <div className="rule-count"><span className="mono">{r.enabled ? r.triggered : "—"}</span><span className="dim sm">hits</span></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="pulse" title="Triggered alerts" sub="Most recent" />
          <div className="alert-feed">
            {ADATA.ALERT_FEED.map((a, i) => {
              const enabled = rules.find(r => r.id === a.rule)?.enabled;
              return (
                <button className={"alert-item" + (enabled ? "" : " muted")} key={i} onClick={() => openProfiler(ADATA.ENTITY_BY_ID[a.entity])}>
                  <span className="alert-bar" style={{ background: ADATA.SEVERITY[a.sev].color }} />
                  <div className="alert-body">
                    <div className="alert-text">{a.text}</div>
                    <div className="alert-meta"><span className="mono dim">{a.rule}</span><span className="mono dim">{a.time}</span>{!enabled && <Tag>rule off</Tag>}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

Object.assign(window, { CounterpartyView, FundFlowView, QueriesView, AlertsView });
