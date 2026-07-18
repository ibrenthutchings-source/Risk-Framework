// views_intel.jsx — Counterparty Intel, Fund-Flow Trace, Audit Queries, Alerts
const { useState: useStateV2, useEffect: useEffectV2, useRef: useRefV2 } = React;

// ============ COUNTERPARTY INTELLIGENCE — not modeled server-side ============
function CounterpartyView({ client }) {
  return (
    <div className="view">
      <UnavailablePanel
        title="Counterparty intelligence isn't connected"
        reason="There's no entity-labeling table in the backend schema (no equivalent of the prototype's ENTITY_TYPES/ENTITIES mock). Wiring this up means designing and building that data model first, not just pointing at an existing endpoint."
      />
    </div>
  );
}

// ============ FUND-FLOW TRACE — not modeled server-side ============
function FundFlowView({ client }) {
  return (
    <div className="view">
      <UnavailablePanel
        title="Fund-flow tracing isn't connected"
        reason="Same gap as counterparty intel — there's no fund-flow graph table or trace computation on the backend. The prototype's Sankey view was pure mock data."
      />
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
