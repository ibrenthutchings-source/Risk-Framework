// export_workpaper.jsx — Simulated workpaper export modal
const { useState: useStateEW, useEffect: useEffectEW, useCallback: useCallbackEW } = React;

const EXPORT_SECTIONS = [
  { id: "exec", label: "Executive Summary", desc: "Engagement overview, scope & risk posture", size: "~2 pages", required: true },
  { id: "findings", label: "Findings & Risk Register", desc: "All findings with severity, evidence & remediation", size: "~4 pages", required: true },
  { id: "assertions", label: "Assertion Coverage Matrix", desc: "Financial-statement assertion testing results", size: "~1 page", required: false },
  { id: "tokens", label: "Token Existence & Ownership", desc: "Balance reconciliation at block height", size: "~2 pages", required: false },
  { id: "contracts", label: "Smart Contract Behavior", desc: "Control surface, centralization & privilege analysis", size: "~3 pages", required: false },
  { id: "counterparty", label: "Counterparty Intelligence", desc: "Entity-resolved exposure & flagged counterparties", size: "~2 pages", required: false },
  { id: "flow", label: "Fund-Flow Analysis", desc: "Source & use of funds trace documentation", size: "~2 pages", required: false },
  { id: "tokenomics", label: "Tokenomics → Financial Bridge", desc: "On-chain events mapped to accounting treatment", size: "~3 pages", required: false },
  { id: "governance", label: "Governance Activity", desc: "Proposals, parameter changes & voting records", size: "~1 page", required: false },
  { id: "infra", label: "Validators & Custody", desc: "Consensus activity & key custody health", size: "~1 page", required: false },
  { id: "trail", label: "Audit Trail & Sign-offs", desc: "Activity log, evidence chain & reviewer approvals", size: "~2 pages", required: true },
];

const EXPORT_STEPS = [
  { label: "Validating engagement scope", duration: 600 },
  { label: "Compiling findings & evidence", duration: 800 },
  { label: "Reconciling on-chain data at block height", duration: 1000 },
  { label: "Generating assertion coverage matrix", duration: 600 },
  { label: "Rendering fund-flow diagrams", duration: 700 },
  { label: "Assembling workpaper document", duration: 800 },
  { label: "Applying digital signatures", duration: 400 },
  { label: "Finalizing export", duration: 300 },
];

function ExportWorkpaperModal({ client, onClose }) {
  const [phase, setPhase] = useStateEW("config"); // config | generating | complete
  const [format, setFormat] = useStateEW("pdf");
  const [sections, setSections] = useStateEW(
    EXPORT_SECTIONS.reduce((a, s) => ({ ...a, [s.id]: true }), {})
  );
  const [step, setStep] = useStateEW(0);
  const [progress, setProgress] = useStateEW(0);

  const toggleSection = (id) => {
    const sec = EXPORT_SECTIONS.find(s => s.id === id);
    if (sec.required) return;
    setSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedCount = Object.values(sections).filter(Boolean).length;
  const estPages = EXPORT_SECTIONS.filter(s => sections[s.id]).reduce((a, s) => {
    const n = parseInt(s.size.match(/\d+/)?.[0] || "1");
    return a + n;
  }, 0);

  const startExport = useCallbackEW(() => {
    setPhase("generating");
    setStep(0);
    setProgress(0);

    let currentStep = 0;
    const totalSteps = EXPORT_STEPS.length;

    const advance = () => {
      if (currentStep >= totalSteps) {
        setPhase("complete");
        return;
      }
      setStep(currentStep);
      setProgress(((currentStep + 0.5) / totalSteps) * 100);

      setTimeout(() => {
        currentStep++;
        setProgress((currentStep / totalSteps) * 100);
        setTimeout(advance, 150);
      }, EXPORT_STEPS[currentStep].duration);
    };
    advance();
  }, []);

  const formatOpts = [
    { id: "pdf", label: "PDF", desc: "Print-ready workpaper", icon: "📄" },
    { id: "xlsx", label: "Excel", desc: "Data tables & schedules", icon: "📊" },
    { id: "docx", label: "Word", desc: "Editable narrative", icon: "📝" },
  ];

  return (
    <div className="ew-scrim" onClick={onClose}>
      <div className="ew-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ew-header">
          <div className="ew-header-l">
            <div className="ew-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h6" />
              </svg>
            </div>
            <div>
              <div className="ew-title">Export workpaper</div>
              <div className="ew-subtitle">{client.name} · {client.fy}</div>
            </div>
          </div>
          <button className="ew-close" onClick={onClose}>✕</button>
        </div>

        {/* Config phase */}
        {phase === "config" && (
          <div className="ew-body">
            {/* Format selector */}
            <div className="ew-section-label">Output format</div>
            <div className="ew-formats">
              {formatOpts.map(f => (
                <button key={f.id} className={"ew-fmt" + (format === f.id ? " on" : "")} onClick={() => setFormat(f.id)}>
                  <span className="ew-fmt-icon">{f.icon}</span>
                  <div className="ew-fmt-name">{f.label}</div>
                  <div className="ew-fmt-desc">{f.desc}</div>
                </button>
              ))}
            </div>

            {/* Section picker */}
            <div className="ew-section-label">Sections to include <span className="ew-section-count">{selectedCount}/{EXPORT_SECTIONS.length}</span></div>
            <div className="ew-sections">
              {EXPORT_SECTIONS.map(s => (
                <button key={s.id}
                  className={"ew-sec" + (sections[s.id] ? " on" : "") + (s.required ? " req" : "")}
                  onClick={() => toggleSection(s.id)}>
                  <span className="ew-check">{sections[s.id] ? "✓" : ""}</span>
                  <div className="ew-sec-body">
                    <div className="ew-sec-name">{s.label}{s.required && <span className="ew-req">Required</span>}</div>
                    <div className="ew-sec-desc">{s.desc}</div>
                  </div>
                  <span className="ew-sec-size mono">{s.size}</span>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="ew-config-foot">
              <div className="ew-est">
                <span className="ew-est-label">Estimated output</span>
                <span className="ew-est-val mono">~{estPages} pages · {format.toUpperCase()}</span>
              </div>
              <div className="ew-foot-btns">
                <button className="ew-cancel" onClick={onClose}>Cancel</button>
                <button className="ew-export-btn" onClick={startExport}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h6" />
                  </svg>
                  Generate workpaper
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generating phase */}
        {phase === "generating" && (
          <div className="ew-body ew-gen">
            <div className="ew-gen-header">
              <div className="ew-gen-spinner"></div>
              <div>
                <div className="ew-gen-title">Generating workpaper…</div>
                <div className="ew-gen-sub">{client.name} · {selectedCount} sections · {format.toUpperCase()}</div>
              </div>
            </div>

            <div className="ew-progress-wrap">
              <div className="ew-progress-bar">
                <div className="ew-progress-fill" style={{ width: progress + "%" }}></div>
              </div>
              <div className="ew-progress-pct mono">{Math.round(progress)}%</div>
            </div>

            <div className="ew-steps">
              {EXPORT_STEPS.map((s, i) => (
                <div key={i} className={"ew-step" + (i < step ? " done" : i === step ? " active" : "")}>
                  <span className="ew-step-icon">{i < step ? "✓" : i === step ? "●" : "○"}</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete phase */}
        {phase === "complete" && (
          <div className="ew-body ew-done">
            <div className="ew-done-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--low)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-5" />
              </svg>
            </div>
            <div className="ew-done-title">Workpaper ready</div>
            <div className="ew-done-sub">Your audit workpaper has been generated and is ready for download.</div>

            <div className="ew-done-file">
              <div className="ew-file-icon">
                {format === "pdf" ? "📄" : format === "xlsx" ? "📊" : "📝"}
              </div>
              <div className="ew-file-info">
                <div className="ew-file-name mono">ChainProof_{client.ticker}_Workpaper_{client.fy.replace(/\s·\s/g, "_")}.{format}</div>
                <div className="ew-file-meta">
                  <span>{selectedCount} sections</span>
                  <span>·</span>
                  <span>~{estPages} pages</span>
                  <span>·</span>
                  <span>{(estPages * 0.18).toFixed(1)} MB</span>
                  <span>·</span>
                  <span>Block #{(21847392).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="ew-done-details">
              <div className="ew-dd-row"><span className="ew-dd-l">Engagement</span><span>{client.name}</span></div>
              <div className="ew-dd-row"><span className="ew-dd-l">Period</span><span>{client.fy}</span></div>
              <div className="ew-dd-row"><span className="ew-dd-l">Format</span><span className="mono">{format.toUpperCase()}</span></div>
              <div className="ew-dd-row"><span className="ew-dd-l">Block height</span><span className="mono">#21,847,392</span></div>
              <div className="ew-dd-row"><span className="ew-dd-l">Generated</span><span className="mono">{new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</span></div>
              <div className="ew-dd-row"><span className="ew-dd-l">Signed by</span><span>Sarah Chen (Lead) · David Park (Partner)</span></div>
            </div>

            <div className="ew-done-actions">
              <button className="ew-download">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download workpaper
              </button>
              <button className="ew-cancel" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ExportWorkpaperModal });
