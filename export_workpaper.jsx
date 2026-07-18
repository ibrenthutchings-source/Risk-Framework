// export_workpaper.jsx — Export workpaper modal, wired to POST /v1/engagements/:id/workpapers
const { useState: useStateEW, useEffect: useEffectEW, useRef: useRefEW } = React;

const EXPORT_SECTIONS = [
  { id: "findings", label: "Findings & Risk Register", desc: "All findings with severity, evidence & remediation", required: true },
  { id: "trail", label: "Audit Trail & Sign-offs", desc: "Activity log, evidence chain & reviewer approvals", required: true },
  { id: "tokens", label: "Token Existence & Ownership", desc: "Balance reconciliation at block height", required: false },
  { id: "contracts", label: "Smart Contract Behavior", desc: "Control surface, centralization & privilege analysis", required: false },
  { id: "governance", label: "Governance Activity", desc: "Proposals, parameter changes & voting records", required: false },
  { id: "tokenomics", label: "Tokenomics → Financial Bridge", desc: "On-chain events mapped to accounting treatment", required: false },
  { id: "infra", label: "Validators & Custody", desc: "Consensus activity & key custody health", required: false },
];

function ExportWorkpaperModal({ client, onClose }) {
  const [phase, setPhase] = useStateEW("config"); // config | generating | complete | error
  const [format, setFormat] = useStateEW("pdf");
  const [sections, setSections] = useStateEW(
    EXPORT_SECTIONS.reduce((a, s) => ({ ...a, [s.id]: true }), {})
  );
  const [job, setJob] = useStateEW(null); // { status, download_url, error }
  const [errorMsg, setErrorMsg] = useStateEW(null);
  const pollRef = useRefEW(null);

  useEffectEW(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const toggleSection = (id) => {
    const sec = EXPORT_SECTIONS.find((s) => s.id === id);
    if (sec.required) return;
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedCount = Object.values(sections).filter(Boolean).length;

  const startExport = async () => {
    setPhase("generating");
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/v1/engagements/${client.id}/workpapers`, {
        method: "POST",
        body: { sections: EXPORT_SECTIONS.filter((s) => sections[s.id]).map((s) => s.id), format },
      });
      const jobId = res.job_id;
      pollRef.current = setInterval(async () => {
        try {
          const status = await apiFetch(`/v1/workpapers/${jobId}`);
          if (status.status === "complete" || status.status === "error") {
            clearInterval(pollRef.current);
            setJob(status);
            setPhase(status.status === "complete" ? "complete" : "error");
          }
        } catch (err) {
          clearInterval(pollRef.current);
          setErrorMsg(err.message);
          setPhase("error");
        }
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("error");
    }
  };

  const formatOpts = [
    { id: "pdf", label: "PDF", desc: "Print-ready workpaper", icon: "📄" },
    { id: "xlsx", label: "Excel", desc: "Data tables & schedules", icon: "📊" },
    { id: "docx", label: "Word", desc: "Editable narrative", icon: "📝" },
  ];

  return (
    <div className="ew-scrim" onClick={onClose}>
      <div className="ew-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ew-header">
          <div className="ew-header-l">
            <div className="ew-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h6" />
              </svg>
            </div>
            <div>
              <div className="ew-title">Export workpaper</div>
              <div className="ew-subtitle">{client.name} · {client.fiscal_period || "no period set"}</div>
            </div>
          </div>
          <button className="ew-close" onClick={onClose}>✕</button>
        </div>

        {phase === "config" && (
          <div className="ew-body">
            <div className="ew-section-label">Output format</div>
            <div className="ew-formats">
              {formatOpts.map((f) => (
                <button key={f.id} className={"ew-fmt" + (format === f.id ? " on" : "")} onClick={() => setFormat(f.id)}>
                  <span className="ew-fmt-icon">{f.icon}</span>
                  <div className="ew-fmt-name">{f.label}</div>
                  <div className="ew-fmt-desc">{f.desc}</div>
                </button>
              ))}
            </div>

            <div className="ew-section-label">Sections to include <span className="ew-section-count">{selectedCount}/{EXPORT_SECTIONS.length}</span></div>
            <div className="ew-sections">
              {EXPORT_SECTIONS.map((s) => (
                <button key={s.id}
                  className={"ew-sec" + (sections[s.id] ? " on" : "") + (s.required ? " req" : "")}
                  onClick={() => toggleSection(s.id)}>
                  <span className="ew-check">{sections[s.id] ? "✓" : ""}</span>
                  <div className="ew-sec-body">
                    <div className="ew-sec-name">{s.label}{s.required && <span className="ew-req">Required</span>}</div>
                    <div className="ew-sec-desc">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="ew-config-foot">
              <div className="ew-est">
                <span className="ew-est-label">Output</span>
                <span className="ew-est-val mono">{selectedCount} sections · {format.toUpperCase()}</span>
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

        {phase === "generating" && (
          <div className="ew-body ew-gen">
            <div className="ew-gen-header">
              <div className="ew-gen-spinner"></div>
              <div>
                <div className="ew-gen-title">Generating workpaper…</div>
                <div className="ew-gen-sub">{client.name} · {selectedCount} sections · {format.toUpperCase()}</div>
              </div>
            </div>
            <div className="dim sm">Queued on the worker (dune-execution style job) — this polls GET /v1/workpapers/:job_id every 1.5s.</div>
          </div>
        )}

        {phase === "error" && (
          <div className="ew-body ew-done">
            <div className="login-error" style={{ width: "100%" }}><Icon path={ICONS.alert} size={14} />{errorMsg || job?.error || "Generation failed"}</div>
            <div className="ew-done-actions" style={{ marginTop: 14 }}>
              <button className="ew-cancel" onClick={() => setPhase("config")}>Back</button>
              <button className="ew-cancel" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div className="ew-body ew-done">
            <div className="ew-done-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--low)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-5" />
              </svg>
            </div>
            <div className="ew-done-title">Workpaper ready</div>
            <div className="ew-done-sub">Generated by the worker and uploaded to object storage.</div>

            <div className="ew-done-file">
              <div className="ew-file-icon">{format === "pdf" ? "📄" : format === "xlsx" ? "📊" : "📝"}</div>
              <div className="ew-file-info">
                <div className="ew-file-name mono" style={{ wordBreak: "break-all" }}>{job?.download_url || "—"}</div>
                <div className="ew-file-meta"><span>{selectedCount} sections</span><span>·</span><span>{format.toUpperCase()}</span></div>
              </div>
            </div>

            <div className="ew-done-actions">
              {job?.download_url && <a className="ew-download" href={job.download_url} target="_blank" rel="noreferrer">Open storage object</a>}
              <button className="ew-cancel" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ExportWorkpaperModal });
