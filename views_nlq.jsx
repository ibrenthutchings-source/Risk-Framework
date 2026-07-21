// views_nlq.jsx — AI query, backed by POST /v1/engagements/:id/nlq (real
// LLM call grounded in this engagement's actual findings/feed_events/
// counterparty/token/contract data — see backend/src/nlq.ts). Returns 501
// until ANTHROPIC_API_KEY is configured on the API service.
const { useState: useStateNLQ } = React;

function NLQView({ client }) {
  const [question, setQuestion] = useStateNLQ("");
  const [history, setHistory] = useStateNLQ([]);
  const [busy, setBusy] = useStateNLQ(false);

  const ask = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setBusy(true);
    setHistory((h) => [{ question: q, pending: true }, ...h]);
    try {
      const res = await apiFetch(`/v1/engagements/${client.id}/nlq`, { method: "POST", body: { question: q } });
      setHistory((h) => h.map((item, i) => (i === 0 ? { question: q, answer: res.data.answer, citations: res.data.citations } : item)));
    } catch (err) {
      const notConfigured = err.status === 501;
      setHistory((h) => h.map((item, i) => (i === 0 ? { question: q, error: err.message, notConfigured } : item)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view">
      <Panel pad={false}>
        <PanelHead icon="nlq" title="AI query" sub="Ask about this engagement — answered only from its real recorded data, with citations" />
        <form onSubmit={ask} style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <input
            style={{ flex: 1, height: 36, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--bg)", color: "var(--txt)" }}
            placeholder="e.g. What's our largest counterparty exposure?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={busy}
          />
          <button className="btn-sm" type="submit" disabled={busy || !question.trim()}>{busy ? "Asking…" : "Ask"}</button>
        </form>

        {history.length === 0 ? (
          <EmptyPanel
            title="No questions asked yet"
            sub="Answers are generated from this engagement's real findings, transactions, and counterparty data — not general knowledge."
          />
        ) : (
          <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            {history.map((h, i) => (
              <div key={i} style={{ borderBottom: i < history.length - 1 ? "1px solid var(--line)" : "none", paddingBottom: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{h.question}</div>
                {h.pending && <div className="state-row"><span className="state-spinner" /><span className="dim">Thinking…</span></div>}
                {h.error && (
                  <div className="dim sm" style={{ color: "var(--high)" }}>
                    {h.notConfigured ? "AI query isn't enabled yet — set ANTHROPIC_API_KEY on the API service to turn it on." : h.error}
                  </div>
                )}
                {h.answer && <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 8 }}>{h.answer}</div>}
                {h.citations && h.citations.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {h.citations.map((c, j) => (
                      <Tag key={j} tone="info" title={c.note}>
                        {c.type}: <span className="mono">{c.ref.length > 14 ? c.ref.slice(0, 6) + "…" + c.ref.slice(-4) : c.ref}</span>
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

Object.assign(window, { NLQView });
