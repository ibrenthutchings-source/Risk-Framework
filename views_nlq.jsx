// views_nlq.jsx — Natural Language Query view
const { useState: useStateNLQ, useEffect: useEffectNLQ, useRef: useRefNLQ, useCallback: useCallbackNLQ } = React;

function NLQView({ client }) {
  const [query, setQuery] = useStateNLQ("");
  const [history, setHistory] = useStateNLQ(ADATA.NLQ_HISTORY);
  const [activeId, setActiveId] = useStateNLQ(null);
  const [phase, setPhase] = useStateNLQ(-1); // -1 = idle, 0..N = thinking phases
  const [showSql, setShowSql] = useStateNLQ(true);
  const inputRef = useRefNLQ(null);
  const resultsRef = useRefNLQ(null);

  const active = history.find(h => h.id === activeId);
  const isThinking = phase >= 0;

  const submit = useCallbackNLQ((text) => {
    const q = (text || query).trim();
    if (!q || isThinking) return;
    setQuery("");

    // Find if we have a matching mock, otherwise use first mock as template
    const match = ADATA.NLQ_HISTORY.find(h => h.query.toLowerCase() === q.toLowerCase());
    const template = match || ADATA.NLQ_HISTORY[0];

    const newEntry = {
      ...template,
      id: "nlq-" + Date.now(),
      query: q,
      ts: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
    };

    // Simulate thinking phases
    setPhase(0);
    const phases = ADATA.NLQ_THINKING_PHASES;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      if (step >= phases.length) {
        clearInterval(iv);
        setPhase(-1);
        setHistory(prev => [newEntry, ...prev]);
        setActiveId(newEntry.id);
      } else {
        setPhase(step);
      }
    }, 420);
  }, [query, isThinking]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  // Auto-focus input
  useEffectNLQ(() => { inputRef.current?.focus(); }, []);

  // Scroll results into view
  useEffectNLQ(() => {
    if (activeId && resultsRef.current) {
      resultsRef.current.scrollTop = 0;
    }
  }, [activeId]);

  const statusTone = { pass: "ok", flag: "warn", fail: "bad" };
  const statusLabel = { pass: "No exceptions", flag: "Flagged — review needed", fail: "Failed" };
  const phases = ADATA.NLQ_THINKING_PHASES;

  return (
    <div className="view nlq-view">
      {/* Input area */}
      <div className="nlq-input-wrap">
        <div className="nlq-input-box">
          <div className="nlq-input-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3C7 3 3 7 3 12s4 9 9 9c1.5 0 3-.4 4.2-1" />
              <path d="M21 21l-4-4" />
              <path d="M8 12h8M12 8v8" />
            </svg>
          </div>
          <textarea
            ref={inputRef}
            className="nlq-input"
            placeholder="Ask anything about the audit — transactions, findings, risk exposure, contracts…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            disabled={isThinking}
          ></textarea>
          <button className={"nlq-submit" + (query.trim() && !isThinking ? " active" : "")} onClick={() => submit()} disabled={!query.trim() || isThinking}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="nlq-input-hint">
          <span className="mono">↵</span> to submit
          <span className="nlq-sep">·</span>
          Queries are translated to SQL and run against on-chain data
        </div>
      </div>

      {/* Thinking state */}
      {isThinking && (
        <div className="nlq-thinking">
          <div className="nlq-thinking-card">
            <div className="nlq-thinking-spinner"></div>
            <div className="nlq-thinking-body">
              <div className="nlq-thinking-label">Processing query</div>
              <div className="nlq-thinking-phase">{phases[phase]}</div>
              <div className="nlq-thinking-steps">
                {phases.map((p, i) => (
                  <div key={i} className={"nlq-step" + (i < phase ? " done" : i === phase ? " active" : "")}>
                    <span className="nlq-step-dot">{i < phase ? "✓" : i === phase ? "●" : "○"}</span>
                    <span>{p.replace("…", "")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state — suggestions */}
      {!isThinking && !activeId && (
        <div className="nlq-empty">
          <div className="nlq-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
              <path d="M12 3C7 3 3 7 3 12s4 9 9 9c1.5 0 3-.4 4.2-1" />
              <path d="M21 21l-4-4" />
              <path d="M8 12h8M12 8v8" />
            </svg>
          </div>
          <div className="nlq-empty-title">Query the audit in plain English</div>
          <div className="nlq-empty-sub">Ask about transactions, counterparty risk, contract behavior, assertion coverage, or any on-chain data in scope.</div>

          <div className="nlq-suggestions">
            <div className="nlq-suggestions-label">Suggested queries</div>
            <div className="nlq-chips">
              {ADATA.NLQ_SUGGESTED.map((s, i) => (
                <button key={i} className="nlq-chip" onClick={() => { setQuery(s.text); setTimeout(() => submit(s.text), 60); }}>
                  <span className="nlq-chip-cat">{s.cat}</span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>

          {history.length > 0 && (
            <div className="nlq-recent">
              <div className="nlq-suggestions-label">Recent queries</div>
              <div className="nlq-recent-list">
                {history.slice(0, 4).map(h => (
                  <button key={h.id} className="nlq-recent-item" onClick={() => setActiveId(h.id)}>
                    <div className="nlq-recent-q">{h.query}</div>
                    <div className="nlq-recent-meta">
                      <span className="mono dim">{h.ts}</span>
                      <Tag tone={statusTone[h.status]}>{statusLabel[h.status]}</Tag>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active result */}
      {!isThinking && active && (
        <div className="nlq-result" ref={resultsRef}>
          <div className="nlq-result-header">
            <button className="nlq-back" onClick={() => setActiveId(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              All queries
            </button>
            <div className="nlq-result-ts mono dim">{active.ts}</div>
          </div>

          <div className="nlq-result-query">
            <div className="nlq-rq-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3C7 3 3 7 3 12s4 9 9 9c1.5 0 3-.4 4.2-1" /><path d="M21 21l-4-4" /><path d="M8 12h8M12 8v8" />
              </svg>
            </div>
            <div className="nlq-rq-text">{active.query}</div>
          </div>

          {/* Intent */}
          <div className="nlq-section">
            <div className="nlq-section-head">
              <span className="nlq-section-icon">⟐</span>
              Interpreted intent
            </div>
            <div className="nlq-intent">{active.intent}</div>
          </div>

          {/* Summary */}
          <div className="nlq-summary-card">
            <div className="nlq-summary-bar" style={{ background: active.status === "flag" ? "var(--med)" : active.status === "fail" ? "var(--crit)" : "var(--low)" }}></div>
            <div className="nlq-summary-body">
              <div className="nlq-summary-top">
                <Tag tone={statusTone[active.status]}>{statusLabel[active.status]}</Tag>
                {active.findings.length > 0 && active.findings.map(f => (
                  <span key={f} className="nlq-finding-link mono">{f}</span>
                ))}
                {active.assertions.map(a => (
                  <Tag key={a} tone="info">{a}</Tag>
                ))}
              </div>
              <div className="nlq-summary-text">{active.summary}</div>
            </div>
          </div>

          {/* Generated SQL */}
          <div className="nlq-section">
            <button className="nlq-section-head nlq-toggle" onClick={() => setShowSql(s => !s)}>
              <span className="nlq-section-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
              </span>
              Generated SQL
              <span className={"nlq-caret" + (showSql ? " open" : "")}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </button>
            {showSql && (
              <div className="nlq-sql-wrap">
                <pre className="nlq-sql mono">{active.sql}</pre>
              </div>
            )}
          </div>

          {/* Results table */}
          <div className="nlq-section">
            <div className="nlq-section-head">
              <span className="nlq-section-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>
              </span>
              Results
              <span className="nlq-row-count mono">{active.results.length} rows</span>
            </div>
            <div className="nlq-table-wrap">
              <table className="nlq-table">
                <thead>
                  <tr>{active.cols.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {active.results.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className={j === 0 || cell.startsWith("0x") || cell.startsWith("#") || cell.startsWith("$") || cell.startsWith("−") ? "mono" : ""}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Follow-up suggestions */}
          {active.followups && active.followups.length > 0 && (
            <div className="nlq-section">
              <div className="nlq-section-head">
                <span className="nlq-section-icon">→</span>
                Follow-up queries
              </div>
              <div className="nlq-followups">
                {active.followups.map((f, i) => (
                  <button key={i} className="nlq-followup" onClick={() => { setQuery(f); setTimeout(() => submit(f), 60); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { NLQView });
