// app.jsx — shell, auth gate, engagement selection, navigation, tweaks.
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#3b82f6",
  "density": "regular",
  "uiScale": 100,
  "monoHashes": true,
  "scanlines": false
}/*EDITMODE-END*/;

const NAV = [
  { id: "overview", label: "Overview", icon: "grid", group: "Engagement" },
  { id: "trail", label: "Audit Trail", icon: "clock", group: "Engagement" },
  { id: "feed", label: "Live Feed", icon: "pulse", group: "Security & authenticity" },
  { id: "counterparty", label: "Counterparty Intel", icon: "search", group: "Security & authenticity" },
  { id: "flow", label: "Fund-Flow Trace", icon: "flow", group: "Security & authenticity" },
  { id: "risk", label: "Risk Register", icon: "shield", group: "Security & authenticity" },
  { id: "alerts", label: "Alerts", icon: "bell", group: "Security & authenticity" },
  { id: "tokens", label: "Token & Ownership", icon: "coins", group: "Assertions" },
  { id: "contracts", label: "Contract Behavior", icon: "contract", group: "Assertions" },
  { id: "infra", label: "Validators & Custody", icon: "server", group: "Assertions" },
  { id: "governance", label: "Governance", icon: "vote", group: "Assertions" },
  { id: "tokenomics", label: "Tokenomics → Financials", icon: "scale", group: "Financial reporting" },
  { id: "queries", label: "Audit Queries", icon: "query", group: "Analytics" },
  { id: "nlq", label: "AI Query", icon: "nlq", group: "Analytics" },
];

const VIEW_META = {
  trail: ["Audit trail", "Activity log, sign-offs & review workflow"],
  overview: ["Engagement overview", "Portfolio risk posture & assertion coverage"],
  feed: ["Real-time transaction analysis", "Streaming anomaly detection on tagged addresses"],
  counterparty: ["Counterparty intelligence", "Entity-resolved exposure & wallet profiling"],
  flow: ["Fund-flow trace", "Source & use of funds across hops"],
  risk: ["Risk register", "Findings rated by impact × likelihood"],
  alerts: ["Alert rules", "Configurable continuous-audit monitoring"],
  tokens: ["Token existence & ownership", "Balance reconciliation at block height"],
  contracts: ["Smart-contract behavior", "Control surface & centralization risk"],
  infra: ["Validators & key custody", "Consensus activity & custody health"],
  governance: ["Governance & parameters", "On-chain proposals, votes & parameter changes"],
  tokenomics: ["Tokenomics → financial reporting", "Economic events mapped to accounting treatment"],
  queries: ["Audit query library", "Reusable, versioned on-chain audit procedures"],
  nlq: ["Natural language query", "Ask anything about the audit in plain English"],
};

const ENTITY_TYPE_LABELS = {
  defi_lending: "DeFi lending protocol",
  dao_treasury: "Governance / treasury",
  l2_infra: "L2 infra / staking",
  other: "Other",
};

// ---------- Onboarding: create the first engagement ----------
function CreateEngagementForm({ onCreated }) {
  const [name, setName] = useStateApp("");
  const [ticker, setTicker] = useStateApp("");
  const [entityType, setEntityType] = useStateApp("defi_lending");
  const [fiscalPeriod, setFiscalPeriod] = useStateApp("");
  const [busy, setBusy] = useStateApp(false);
  const [error, setError] = useStateApp(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/v1/engagements", {
        method: "POST",
        body: { name, ticker: ticker || undefined, entity_type: entityType, fiscal_period: fiscalPeriod || undefined },
      });
      onCreated();
    } catch (err) {
      setError(err.message || "Could not create engagement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="onboard-form" onSubmit={submit}>
      <input placeholder="Client name (e.g. Aurora Protocol)" value={name} onChange={(e) => setName(e.target.value)} required />
      <input placeholder="Ticker (optional)" value={ticker} onChange={(e) => setTicker(e.target.value)} />
      <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
        {Object.entries(ENTITY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input placeholder="Fiscal period (e.g. FY2026-Q1)" value={fiscalPeriod} onChange={(e) => setFiscalPeriod(e.target.value)} />
      {error && <div className="login-error"><Icon path={ICONS.alert} size={14} />{error}</div>}
      <button type="submit" disabled={busy || !name}>{busy ? "Creating…" : "Create engagement"}</button>
    </form>
  );
}

function App() {
  const [authed, setAuthed] = useStateApp(!!getToken());
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [nav, setNav] = useStateApp("overview");
  const [clientId, setClientId] = useStateApp(null);
  const [clientOpen, setClientOpen] = useStateApp(false);
  const [showExport, setShowExport] = useStateApp(false);

  const { data: engagements, loading, error, reload } = useApi(authed ? "/v1/engagements" : null);

  useEffectApp(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    const pad = t.density === "compact" ? "12px" : t.density === "comfy" ? "24px" : "18px";
    document.documentElement.style.setProperty("--gut", pad);
    document.documentElement.style.fontSize = (t.uiScale / 100 * 15) + "px";
  }, [t.accent, t.density, t.uiScale]);

  useEffectApp(() => {
    if (engagements && engagements.length && !clientId) setClientId(engagements[0].id);
  }, [engagements]);

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  if (loading) {
    return <div className="login-screen"><div className="state-row"><span className="state-spinner" /><span>Loading engagements…</span></div></div>;
  }

  if (error) {
    if (error.status === 401) { setAuthed(false); return null; }
    return (
      <div className="login-screen">
        <div className="state-empty">
          <div className="state-empty-title">Couldn't load engagements</div>
          <div className="dim sm">{error.message}</div>
          <button className="btn-sm" style={{ marginTop: 10 }} onClick={reload}>Retry</button>
        </div>
      </div>
    );
  }

  if (!engagements || engagements.length === 0) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ width: 400 }}>
          <div className="login-brand">
            <svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2l8 5v10l-8 5-8-5V7z" fill="none" stroke="var(--accent)" strokeWidth="1.6" /><path d="M12 7l4 2.5v5L12 17l-4-2.5v-5z" fill="var(--accent)" opacity="0.25" /><circle cx="12" cy="12" r="1.6" fill="var(--accent)" /></svg>
            <div><div className="brand-name">CHAINPROOF</div><div className="brand-sub">Audit & Assurance</div></div>
          </div>
          <div className="login-title">No engagements yet</div>
          <div className="login-sub">This firm has no engagements. Create the first one to get started.</div>
          <CreateEngagementForm onCreated={reload} />
          <button className="btn-sm" style={{ marginTop: 8 }} onClick={() => { logout(); setAuthed(false); }}>Sign out</button>
        </div>
      </div>
    );
  }

  const client = engagements.find((c) => c.id === clientId) || engagements[0];
  const meta = VIEW_META[nav];
  const groups = [...new Set(NAV.map((n) => n.group))];

  let ViewEl = null;
  if (nav === "overview") ViewEl = <OverviewView client={client} />;
  else if (nav === "trail") ViewEl = <AuditTrailView client={client} />;
  else if (nav === "feed") ViewEl = <LiveFeedView client={client} />;
  else if (nav === "counterparty") ViewEl = <CounterpartyView client={client} />;
  else if (nav === "flow") ViewEl = <FundFlowView client={client} />;
  else if (nav === "risk") ViewEl = <RiskRegisterView client={client} />;
  else if (nav === "alerts") ViewEl = <AlertsView client={client} />;
  else if (nav === "tokens") ViewEl = <TokensView client={client} />;
  else if (nav === "contracts") ViewEl = <ContractsView client={client} />;
  else if (nav === "infra") ViewEl = <InfraView client={client} />;
  else if (nav === "governance") ViewEl = <GovernanceView client={client} />;
  else if (nav === "tokenomics") ViewEl = <TokenomicsView client={client} />;
  else if (nav === "queries") ViewEl = <QueriesView client={client} />;
  else if (nav === "nlq") ViewEl = <NLQView client={client} />;

  return (
    <div className={"app dens-" + t.density + (t.scanlines ? " scan" : "") + (t.monoHashes ? "" : " no-mono")}>
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2l8 5v10l-8 5-8-5V7z" fill="none" stroke="var(--accent)" strokeWidth="1.6"/><path d="M12 7l4 2.5v5L12 17l-4-2.5v-5z" fill="var(--accent)" opacity="0.25"/><circle cx="12" cy="12" r="1.6" fill="var(--accent)"/></svg>
          </span>
          <div className="brand-txt"><div className="brand-name">CHAINPROOF</div><div className="brand-sub">Audit & Assurance</div></div>
        </div>

        <div className="client-sel">
          <button className="client-btn" onClick={() => setClientOpen((o) => !o)}>
            <div className="client-av">{(client.ticker || client.name.slice(0, 3)).toUpperCase()}</div>
            <div className="client-info"><div className="client-name">{client.name}</div><div className="client-meta">{ENTITY_TYPE_LABELS[client.entity_type] || "—"} · {client.fiscal_period || "no period set"}</div></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {clientOpen && (
            <div className="client-drop">
              {engagements.map((c) => (
                <button key={c.id} className={"client-opt" + (c.id === clientId ? " on" : "")} onClick={() => { setClientId(c.id); setClientOpen(false); }}>
                  <div className="client-av sm">{(c.ticker || c.name.slice(0, 3)).toUpperCase()}</div>
                  <div className="client-info"><div className="client-name">{c.name}</div><div className="client-meta">{ENTITY_TYPE_LABELS[c.entity_type] || "—"}</div></div>
                  {c.risk_score != null && <span className="client-risk" style={{ color: c.risk_score >= 70 ? "#dc3545" : c.risk_score >= 45 ? "#e8652a" : "#1a9d5e" }}>{c.risk_score}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="topbar-search">
          <Icon path={ICONS.search} size={15} />
          <input placeholder="Search address, tx hash, contract…" disabled title="Search isn't wired to a backend endpoint yet" />
        </div>

        <div className="topbar-right">
          <div className="user-menu">
            <button className="user-btn" onClick={() => { logout(); setAuthed(false); }}>
              <Icon path={ICONS.dot} size={10} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="body">
        {/* Sidebar */}
        <nav className="sidebar">
          {groups.map((g) => (
            <div className="nav-group" key={g}>
              <div className="nav-glabel">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <button key={n.id} className={"nav-item" + (nav === n.id ? " on" : "")} onClick={() => setNav(n.id)}>
                  <Icon path={ICONS[n.icon]} size={17} />
                  <span>{n.label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="nav-foot">
            <div className="nav-foot-row"><span className="live-dot" /> Connected · {(client.coverage_pct != null ? Math.round(client.coverage_pct * 100) : "—")}% coverage</div>
          </div>
        </nav>

        {/* Main */}
        <main className="main">
          <div className="view-head">
            <div>
              <h1>{meta[0]}</h1>
              <p>{meta[1]}</p>
            </div>
            <div className="view-head-r">
              <div className="vh-client"><span className="dim">Engagement</span> {client.name} <Tag tone="info">{client.fiscal_period || "—"}</Tag></div>
              <button className="btn-export" onClick={() => setShowExport(true)}><Icon path={ICONS.external} size={14} /> Export workpaper</button>
            </div>
          </div>
          {ViewEl}
        </main>
      </div>

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent}
          options={["#3b82f6", "#2ecc8f", "#8b7cf0", "#e8a23d", "#e5e7eb"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="UI scale" value={t.uiScale} min={85} max={120} step={5} unit="%"
          onChange={(v) => setTweak("uiScale", v)} />
        <TweakSection label="Forensic" />
        <TweakToggle label="Monospace hashes" value={t.monoHashes} onChange={(v) => setTweak("monoHashes", v)} />
        <TweakToggle label="Terminal scanlines" value={t.scanlines} onChange={(v) => setTweak("scanlines", v)} />
      </TweaksPanel>

      {showExport && <ExportWorkpaperModal client={client} onClose={() => setShowExport(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
