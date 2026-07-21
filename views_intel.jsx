// views_intel.jsx — Counterparty Intel, Fund-Flow Trace, Audit Queries, Alerts
const { useState: useStateV2, useEffect: useEffectV2, useRef: useRefV2 } = React;

// ============ COUNTERPARTY INTELLIGENCE ============
// Backed by counterparty_labels (manually-curated name/category/risk_tier)
// joined against real feed_events activity at query time — an address only
// shows up once a tracked wallet (Live Feed) has actually transacted with
// it. Labels are optional; unlabeled counterparties still show exposure.
const CATEGORY_LABELS = {
  exchange: "Exchange", bridge: "Bridge", mixer: "Mixer", market_maker: "Market Maker",
  protocol: "Protocol", sanctioned: "Sanctioned", unknown: "Unlabeled",
};

function CounterpartyLabelForm({ client, cp, onSaved, onCancel }) {
  const [name, setName] = useStateV2(cp.name || "");
  const [category, setCategory] = useStateV2(cp.category || "unknown");
  const [riskTier, setRiskTier] = useStateV2(cp.risk_tier || "low");
  const [note, setNote] = useStateV2(cp.note || "");
  const [busy, setBusy] = useStateV2(false);
  const [error, setError] = useStateV2(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/engagements/${client.id}/counterparties`, {
        method: "POST",
        body: { chain: cp.chain, address: cp.address, name: name || undefined, category, risk_tier: riskTier, note: note || undefined },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="onboard-form"
      onSubmit={save}
      onClick={(e) => e.stopPropagation()}
      style={{ flexDirection: "row", flexWrap: "wrap", width: "auto", maxWidth: "none", padding: "12px 16px", background: "var(--bg)", borderBottom: "1px solid var(--line)" }}
    >
      <input placeholder="Label (e.g. Binance Hot Wallet)" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={riskTier} onChange={(e) => setRiskTier(e.target.value)}>
        <option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option><option value="critical">Critical risk</option>
      </select>
      <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
      <button className="btn-sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save label"}</button>
      <button type="button" className="btn-sm" onClick={onCancel}>Cancel</button>
      {error && <span className="dim sm" style={{ color: "var(--high)" }}>{error}</span>}
    </form>
  );
}

function CounterpartyView({ client }) {
  const { data: cps, loading, error, reload } = useApi(`/v1/engagements/${client.id}/counterparties`);
  const [editing, setEditing] = useStateV2(null);

  if (loading) return <div className="view"><LoadingPanel label="Loading counterparty exposure…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = cps || [];
  if (list.length === 0) {
    return (
      <div className="view">
        <EmptyPanel
          title="No counterparty activity yet"
          sub="Counterparties appear here once a tracked wallet transacts with them — add one under Live Feed first."
        />
      </div>
    );
  }

  const flagged = list.filter((c) => c.risk_tier === "high" || c.risk_tier === "critical" || c.category === "sanctioned");
  const unlabeled = list.filter((c) => !c.name).length;
  const totalTx = list.reduce((s, c) => s + c.tx_count, 0);
  const keyOf = (c) => c.chain + ":" + c.address;

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Counterparties" value={list.length} sub="distinct addresses transacted with" /></Panel>
        <Panel><Stat label="Flagged" value={flagged.length} tone={flagged.length ? "#dc3545" : undefined} sub="high/critical risk or sanctioned" /></Panel>
        <Panel><Stat label="Unlabeled" value={unlabeled} sub="no intel recorded yet" /></Panel>
        <Panel><Stat label="Transactions" value={totalTx} sub="across tracked wallets" /></Panel>
      </div>

      {flagged.length > 0 && (
        <Panel pad={false} style={{ marginTop: 14 }}>
          <PanelHead icon="alert" title="Flagged exposures" sub="High/critical risk or sanctioned counterparties" />
          <div className="flag-exp">
            {flagged.map((c) => (
              <div className="flag-card" key={keyOf(c)}>
                <div className="flag-top">
                  <span className="flag-name">{c.name || "Unlabeled"}</span>
                  <Tag tone="bad">{CATEGORY_LABELS[c.category]}</Tag>
                </div>
                {c.note && <div className="flag-note">{c.note}</div>}
                <div className="flag-addr mono">{c.chain} · {c.address}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="search" title="Counterparty exposure" sub={`${list.length} addresses, derived from live feed activity`} />
        <div className="ent-table">
          <div className="ent-th"><div>Entity</div><div>Category</div><div>Chain</div><div>Risk</div><div>Txns</div><div>Volume</div><div>Detail</div></div>
          {list.map((c) => (
            <React.Fragment key={keyOf(c)}>
              <div className="ent-tr" onClick={() => setEditing(editing === keyOf(c) ? null : keyOf(c))}>
                <div className="ent-cell-name">
                  <span className={"ent-label" + (c.risk_tier === "high" || c.risk_tier === "critical" ? " risky" : !c.name ? " unlabeled" : "")}>
                    <span className="ent-name">{c.name || (c.address.slice(0, 6) + "…" + c.address.slice(-4))}</span>
                  </span>
                </div>
                <div><Tag tone={c.category === "sanctioned" ? "bad" : "neutral"}>{CATEGORY_LABELS[c.category]}</Tag></div>
                <div className="dim">{c.chain}</div>
                <div><Tag tone={c.risk_tier === "critical" || c.risk_tier === "high" ? "bad" : c.risk_tier === "medium" ? "warn" : "ok"}>{c.risk_tier}</Tag></div>
                <div className="mono">{c.tx_count} <span className="dim sm">({c.in_count} in / {c.out_count} out)</span></div>
                <div className="mono">{weiToEth(c.total_value_wei).toLocaleString(undefined, { maximumFractionDigits: 3 })} ETH</div>
                <div className="dim sm">{editing === keyOf(c) ? "Close ↑" : "Edit label →"}</div>
              </div>
              {editing === keyOf(c) && (
                <CounterpartyLabelForm client={client} cp={c} onSaved={() => { setEditing(null); reload(); }} onCancel={() => setEditing(null)} />
              )}
            </React.Fragment>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ============ FUND-FLOW TRACE ============
// Per-wallet in/out flow derived from feed_events (same source as
// Counterparty Intel). Not a multi-hop trace through untracked third
// parties — we only observe activity where one side is a tracked wallet,
// so this is the honest depth a real trace can go without an external
// indexer or transitively expanding what gets tracked.
function FundFlowView({ client }) {
  const { data: rows, loading, error, reload } = useApi(`/v1/engagements/${client.id}/fund-flow`);

  if (loading) return <div className="view"><LoadingPanel label="Loading fund flow…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = rows || [];
  if (list.length === 0) {
    return (
      <div className="view">
        <EmptyPanel title="No flow activity yet" sub="Fund flow is derived from Live Feed activity — track a wallet under Live Feed and wait for transactions first." />
      </div>
    );
  }

  const byWallet = {};
  for (const r of list) {
    const w = (byWallet[r.wallet_id] = byWallet[r.wallet_id] || { wallet_id: r.wallet_id, address: r.wallet_address, chain: r.chain, label: r.label, in: [], out: [] });
    w[r.direction].push(r);
  }
  const wallets = Object.values(byWallet);
  const sumWei = (arr) => arr.reduce((s, r) => s + BigInt(r.total_value_wei || "0"), 0n);
  const fmt = (bi) => weiToEth(bi.toString()).toLocaleString(undefined, { maximumFractionDigits: 3 });

  return (
    <div className="view">
      <Panel pad={false} style={{ marginBottom: 14 }}>
        <PanelHead icon="flow" title="Fund-flow trace" sub="Per-wallet in/out flow derived from Live Feed activity" />
        <div style={{ padding: "10px 16px" }} className="dim sm">
          Scoped to tracked wallets — reflects direct activity only, not a multi-hop trace through untracked third parties.
        </div>
      </Panel>

      {wallets.map((w) => {
        const totalIn = sumWei(w.in);
        const totalOut = sumWei(w.out);
        const net = totalIn - totalOut;
        const topIn = [...w.in].sort((a, b) => b.tx_count - a.tx_count).slice(0, 6);
        const topOut = [...w.out].sort((a, b) => b.tx_count - a.tx_count).slice(0, 6);
        return (
          <Panel pad={false} key={w.wallet_id} style={{ marginBottom: 14 }}>
            <div className="ff-focus">
              <div className="ff-focus-head">
                <AddrChip value={w.address} />
                <span className="ff-focus-name">{w.label || (w.address.slice(0, 6) + "…" + w.address.slice(-4))}</span>
                <Tag>{w.chain}</Tag>
              </div>
              <div className="ff-iostats">
                <div className="ff-iostat"><div className="ds-label">Inbound</div><div className="ff-io-val">{fmt(totalIn)} ETH</div></div>
                <div className="ff-iostat"><div className="ds-label">Outbound</div><div className="ff-io-val">{fmt(totalOut)} ETH</div></div>
                <div className="ff-iostat">
                  <div className="ds-label">Net</div>
                  <div className="ff-io-val" style={{ color: net >= 0n ? "var(--low)" : "var(--high)" }}>{net >= 0n ? "+" : ""}{fmt(net)} ETH</div>
                </div>
              </div>

              {topIn.length > 0 && (
                <>
                  <div className="ff-io-sec"><Icon path={ICONS.arrow} size={12} /> Top inbound counterparties</div>
                  <div className="ff-io-list">
                    {topIn.map((r) => (
                      <div className="ff-io-row" key={"in-" + r.counterparty}>
                        <AddrChip value={r.counterparty} />
                        <span className="dim sm">{r.tx_count} txns</span>
                        <span className="ff-io-amt mono">{weiToEth(r.total_value_wei).toLocaleString(undefined, { maximumFractionDigits: 3 })} ETH</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {topOut.length > 0 && (
                <>
                  <div className="ff-io-sec"><Icon path={ICONS.arrow} size={12} /> Top outbound counterparties</div>
                  <div className="ff-io-list">
                    {topOut.map((r) => (
                      <div className="ff-io-row" key={"out-" + r.counterparty}>
                        <AddrChip value={r.counterparty} />
                        <span className="dim sm">{r.tx_count} txns</span>
                        <span className="ff-io-amt mono">{weiToEth(r.total_value_wei).toLocaleString(undefined, { maximumFractionDigits: 3 })} ETH</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

// ============ AUDIT QUERY LIBRARY ============
function QueriesView({ client }) {
  const { data: qs, loading, error, reload } = useApi(`/v1/queries`);
  const [sel, setSel] = useStateV2(null);
  const [execState, setExecState] = useStateV2({}); // query_id -> { status, executionId, result }
  const pollRef = useRefV2(null);

  useEffectV2(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (loading) return <div className="view"><LoadingPanel label="Loading query library…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = qs || [];
  if (list.length === 0) {
    return <div className="view"><EmptyPanel title="Query library is empty" sub="No rows in query_library yet — seed some via SQL or a future POST /v1/queries endpoint (not built)." /></div>;
  }

  const q = list.find((x) => x.id === sel) || list[0];
  const state = execState[q.id] || { status: "idle" };

  const run = async () => {
    setExecState((s) => ({ ...s, [q.id]: { status: "queued" } }));
    try {
      const res = await apiFetch(`/v1/queries/${q.id}/execute`, { method: "POST", body: { params: {} } });
      const executionId = res.execution_id;
      setExecState((s) => ({ ...s, [q.id]: { status: "executing", executionId } }));
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const exec = await apiFetch(`/v1/executions/${executionId}`);
          if (exec.data.status === "completed" || exec.data.status === "error") {
            clearInterval(pollRef.current);
            setExecState((s) => ({ ...s, [q.id]: { status: exec.data.status, executionId, result: exec.data.result, rowsScanned: exec.data.rows_scanned } }));
          }
        } catch { clearInterval(pollRef.current); }
      }, 2000);
    } catch (err) {
      setExecState((s) => ({ ...s, [q.id]: { status: "error", error: err.message } }));
    }
  };

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Saved procedures" value={list.length} sub="query_library rows" /></Panel>
        <Panel><Stat label="Categories" value={new Set(list.map((x) => x.category).filter(Boolean)).size} /></Panel>
        <Panel><Stat label="Engines" value={new Set(list.map((x) => x.engine).filter(Boolean)).size} /></Panel>
        <Panel><Stat label="Last run" value={list.some((x) => x.last_run) ? new Date(Math.max(...list.filter((x) => x.last_run).map((x) => new Date(x.last_run)))).toISOString().slice(0, 10) : "never"} /></Panel>
      </div>

      <div className="grid-1-2" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="grid" title="Procedure library" />
          <div className="q-list">
            {list.map((x) => (
              <div className={"q-row" + (q.id === x.id ? " on" : "")} key={x.id} onClick={() => setSel(x.id)}>
                <div className="q-row-top"><span className="mono q-id">{x.id.slice(0, 8)}</span>{x.assertion && <Tag tone="info">{x.assertion}</Tag>}</div>
                <div className="q-name">{x.name}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="contract" title={q.name} sub={q.category}
            right={<button className="btn-run" onClick={run} disabled={state.status === "queued" || state.status === "executing"}>
              {state.status === "queued" || state.status === "executing" ? "Running…" : "▶ Run query"}
            </button>} />
          <div className="q-detail">
            <div className="q-sql">
              <div className="q-sql-head"><span className="mono dim">query_library.sql</span></div>
              <pre className="mono">{q.sql}</pre>
            </div>
            <div className="q-results-head">
              <span>Results</span>
              {state.status === "idle" && <span className="dim sm">not yet executed</span>}
              {(state.status === "queued" || state.status === "executing") && <span className="dim sm">{state.status}…</span>}
              {state.status === "completed" && <Tag tone="ok">{(state.result || []).length} rows · {state.rowsScanned ?? "?"} scanned</Tag>}
              {state.status === "error" && <Tag tone="bad">execution failed</Tag>}
            </div>
            {state.status === "completed" && state.result && state.result.length > 0 && (
              <div className="q-results">
                <table>
                  <thead><tr>{Object.keys(state.result[0]).map((c) => <th key={c} className="mono">{c}</th>)}</tr></thead>
                  <tbody>
                    {state.result.map((row, i) => <tr key={i}>{Object.values(row).map((cell, j) => <td key={j} className="mono">{String(cell)}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ============ ALERTS ENGINE ============
function AlertsView({ client }) {
  const { data: rules, loading: rulesLoading, error: rulesError, reload: reloadRules } = useApi(`/v1/engagements/${client.id}/alert-rules`);
  const { data: instances, loading: instLoading } = useApi(`/v1/engagements/${client.id}/alerts`);
  const [showForm, setShowForm] = useStateV2(false);
  const [name, setName] = useStateV2("");
  const [condition, setCondition] = useStateV2("");
  const [severity, setSeverity] = useStateV2("medium");
  const [busy, setBusy] = useStateV2(false);

  if (rulesLoading || instLoading) return <div className="view"><LoadingPanel label="Loading alert rules…" /></div>;
  if (rulesError) return <div className="view"><ErrorPanel error={rulesError} onRetry={reloadRules} /></div>;

  const ruleList = rules || [];
  const sevTone = { critical: "bad", high: "warn", medium: "neutral", low: "neutral" };

  const createRule = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(`/v1/engagements/${client.id}/alert-rules`, {
        method: "POST",
        body: { name, condition, severity, threshold: 0 },
      });
      setName(""); setCondition(""); setShowForm(false);
      reloadRules();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Alert rules" value={ruleList.length} /></Panel>
        <Panel><Stat label="Enabled" value={ruleList.filter((r) => r.enabled).length} tone="#1a9d5e" /></Panel>
        <Panel><Stat label="Triggered alerts" value={(instances || []).length} tone="#e8652a" /></Panel>
        <Panel><Stat label="Critical instances" value={(instances || []).filter((a) => a.severity === "critical").length} tone="#dc3545" /></Panel>
      </div>

      <div className="grid-2-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="shield" title="Alert rules"
            right={<button className="btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New rule"}</button>} />
          {showForm && (
            <form className="onboard-form" style={{ padding: "12px 16px" }} onSubmit={createRule}>
              <input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input placeholder="Condition (free text)" value={condition} onChange={(e) => setCondition(e.target.value)} required />
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
              <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create rule"}</button>
            </form>
          )}
          {ruleList.length === 0 ? (
            <EmptyPanel title="No alert rules yet" />
          ) : (
            <div className="rule-list">
              {ruleList.map((r) => (
                <div className={"rule-row" + (r.enabled ? "" : " off")} key={r.id}>
                  <div className="rule-main">
                    <div className="rule-name">{r.name} <Tag tone={sevTone[r.severity]}>{r.severity}</Tag>{!r.enabled && <Tag>disabled</Tag>}</div>
                    <div className="rule-cond mono">{r.condition}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="pulse" title="Triggered alerts" sub="Most recent" />
          {(!instances || instances.length === 0) ? (
            <EmptyPanel title="No alerts triggered yet" />
          ) : (
            <div className="alert-feed">
              {instances.map((a) => (
                <div className="alert-item" key={a.id}>
                  <span className="alert-bar" style={{ background: a.severity === "critical" ? "#dc3545" : a.severity === "high" ? "#e8652a" : "#d9940e" }} />
                  <div className="alert-body">
                    <div className="alert-text">{a.text}</div>
                    <div className="alert-meta"><span className="mono dim">{new Date(a.triggered_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

Object.assign(window, { CounterpartyView, FundFlowView, QueriesView, AlertsView });
