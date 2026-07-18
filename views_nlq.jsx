// views_nlq.jsx — Natural language query view (backend returns 501, not built)
function NLQView({ client }) {
  return (
    <div className="view">
      <UnavailablePanel
        title="AI query isn't connected"
        reason={`POST /v1/engagements/${client.id}/nlq returns 501 — it needs an LLM integration that resolves questions to structured queries plus source citations, which isn't built. See backend/README.md for what's stubbed.`}
      />
    </div>
  );
}

Object.assign(window, { NLQView });
