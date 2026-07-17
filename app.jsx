// app.jsx — shell, navigation, client selector, tweaks
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

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [nav, setNav] = useStateApp("overview");
  const [clientId, setClientId] = useStateApp(ADATA.CLIENTS[0].id);
  const [clientOpen, setClientOpen] = useStateApp(false);
  const [block, setBlock] = useStateApp(21847392);
  const [showExport, setShowExport] = useStateApp(false);
  const client = ADATA.CLIENTS.find(c => c.id === clientId);

  useEffectApp(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    const pad = t.density === "compact" ? "12px" : t.density === "comfy" ? "24px" : "18px";
    document.documentElement.style.setProperty("--gut", pad);
    document.documentElement.style.fontSize = (t.uiScale / 100 * 15) + "px";
  }, [t.accent, t.density, t.uiScale]);

  useEffectApp(() => {
    const id = setInterval(() => setBlock(b => b + (Math.random() < 0.5 ? 1 : 0)), 2400);
    return () => clearInterval(id);
  }, []);

  const meta = VIEW_META[nav];
  const groups = [...new Set(NAV.map(n => n.group))];

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
          <button className="client-btn" onClick={() => setClientOpen(o => !o)}>
            <div className="client-av">{client.ticker}</div>
            <div className="client-info"><div className="client-name">{client.name}</div><div className="client-meta">{client.type} · {client.fy}</div></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {clientOpen && (
            <div className="client-drop">
              {ADATA.CLIENTS.map(c => (
                <button key={c.id} className={"client-opt" + (c.id === clientId ? " on" : "")} onClick={() => { setClientId(c.id); setClientOpen(false); }}>
                  <div className="client-av sm">{c.ticker}</div>
                  <div className="client-info"><div className="client-name">{c.name}</div><div className="client-meta">{c.type}</div></div>
                  <span className="client-risk" style={{ color: c.riskScore >= 70 ? "#dc3545" : c.riskScore >= 45 ? "#e8652a" : "#1a9d5e" }}>{c.riskScore}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="topbar-search">
          <Icon path={ICONS.search} size={15} />
          <input placeholder="Search address, tx hash, contract…" />
          <kbd>⌘K</kbd>
        </div>

        <div className="topbar-right">
          <div className="block-ind"><span className="live-dot" /><div><div className="bi-l">Block</div><div className="bi-v mono">#{block.toLocaleString()}</div></div></div>
          <div className="net-ind"><Icon path={ICONS.dot} size={10} /> Mainnet</div>
        </div>
      </header>

      <div className="body">
        {/* Sidebar */}
        <nav className="sidebar">
          {groups.map(g => (
            <div className="nav-group" key={g}>
              <div className="nav-glabel">{g}</div>
              {NAV.filter(n => n.group === g).map(n => (
                <button key={n.id} className={"nav-item" + (nav === n.id ? " on" : "")} onClick={() => setNav(n.id)}>
                  <Icon path={ICONS[n.icon]} size={17} />
                  <span>{n.label}</span>
                  {n.id === "risk" && <span className="nav-badge">{client.openFindings}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="nav-foot">
            <div className="nav-foot-row"><span className="live-dot" /> Synced · {client.coverage * 100 | 0}% coverage</div>
            <div className="nav-foot-sub mono">node: erigon-mainnet-04</div>
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
              <div className="vh-client"><span className="dim">Engagement</span> {client.name} <Tag tone="info">{client.fy}</Tag></div>
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

      <ProfilerDrawer />
      {showExport && <ExportWorkpaperModal client={client} onClose={() => setShowExport(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
