// components.jsx — shared UI primitives for the Blockchain Audit System.
const { useState, useEffect, useRef } = React;

// ---------- Icons (simple line glyphs for nav/affordances) ----------
function Icon({ path, size = 18, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}
const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  pulse: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3"/></>,
  contract: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  scale: <><path d="M12 4v16M5 8l-3 6h6zM19 8l-3 6h6z"/><path d="M5 8h14"/></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r="0.6" fill="currentColor"/><circle cx="7" cy="16.5" r="0.6" fill="currentColor"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>,
  dot: <><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  alert: <><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/></>,
  check: <><path d="M20 6L9 17l-5-5"/></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></>,
  external: <><path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  flow: <><circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 6h4a4 4 0 014 4v0M7 18h4a4 4 0 004-4v0"/></>,
  query: <><path d="M4 6h16M4 12h10M4 18h7"/><circle cx="17" cy="17" r="3"/><path d="M19.5 19.5L22 22"/></>,
  bell: <><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 004 0"/></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></>,
  vote: <><rect x="4" y="3" width="16" height="13" rx="2"/><path d="M9 9l2 2 4-4"/><path d="M8 20h8M12 16v4"/></>,
  chain: <><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4"/><path d="M4 12H2M22 12h-2"/></>,
  link: <><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></>,
  nlq: <><path d="M12 3C7 3 3 7 3 12s4 9 9 9c1.5 0 3-.4 4.2-1"/><path d="M21 21l-4-4"/><path d="M8 12h8M12 8v8"/></>,
};

// ---------- Layout primitives ----------
function Panel({ children, className = "", style = {}, pad = true }) {
  return <div className={"panel " + className} style={{ padding: pad ? 18 : 0, ...style }}>{children}</div>;
}
function PanelHead({ title, sub, right, icon }) {
  return (
    <div className="panel-head">
      <div className="panel-head-l">
        {icon && <span className="panel-head-icon"><Icon path={ICONS[icon]} size={16} /></span>}
        <div>
          <div className="panel-title">{title}</div>
          {sub && <div className="panel-sub">{sub}</div>}
        </div>
      </div>
      {right && <div className="panel-head-r">{right}</div>}
    </div>
  );
}

// ---------- Badges ----------
const SEVERITY_COLORS = {
  critical: { label: "Critical", color: "#dc3545" },
  high: { label: "High", color: "#e8652a" },
  medium: { label: "Medium", color: "#d9940e" },
  low: { label: "Low", color: "#1a9d5e" },
  info: { label: "Informational", color: "#3b82f6" },
};
function SevBadge({ sev, children }) {
  const c = SEVERITY_COLORS[sev] || SEVERITY_COLORS.info;
  return (
    <span className="sev-badge" style={{ color: c.color, background: c.color + "1f", borderColor: c.color + "55" }}>
      <span className="sev-dot" style={{ background: c.color }} />
      {children || c.label}
    </span>
  );
}
function Tag({ children, tone = "neutral" }) {
  const tones = {
    neutral: ["#8896a6", "rgba(0,0,0,0.05)"],
    ok: ["#1a9d5e", "rgba(26,157,94,0.12)"],
    warn: ["#d9940e", "rgba(217,148,14,0.12)"],
    bad: ["#dc3545", "rgba(220,53,69,0.12)"],
    info: ["var(--accent)", "color-mix(in oklab, var(--accent) 14%, transparent)"],
  };
  const [col, bg] = tones[tone] || tones.neutral;
  return <span className="tag" style={{ color: col, background: bg }}>{children}</span>;
}

// ---------- Address / hash chip ----------
function Mono({ children, dim }) { return <span className="mono" style={dim ? { color: "var(--dim)" } : {}}>{children}</span>; }
function AddrChip({ value, kind = "addr" }) {
  const [copied, setCopied] = useState(false);
  const short = value ? value.slice(0, 6) + "…" + value.slice(-4) : "—";
  return (
    <button className="addr-chip" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1100); }}>
      <span className="mono">{short}</span>
      <span className="addr-chip-ic">{copied ? <Icon path={ICONS.check} size={12} /> : <Icon path={ICONS.copy} size={12} />}</span>
    </button>
  );
}

// ---------- Stat card ----------
function Stat({ label, value, sub, tone, spark, delta }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone } : {}}>
        {value}
        {delta != null && <span className={"stat-delta " + (delta >= 0 ? "up" : "dn")}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
      {spark && <Sparkline data={spark} />}
    </div>
  );
}

// ---------- Sparkline ----------
function Sparkline({ data, w = 120, h = 30, color = "var(--accent)" }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / (max - min || 1)) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ---------- Horizontal meter ----------
function Meter({ pct, color = "var(--accent)", h = 6 }) {
  return (
    <div className="meter" style={{ height: h }}>
      <div className="meter-fill" style={{ width: (pct * 100).toFixed(0) + "%", background: color, height: h }} />
    </div>
  );
}

// ---------- Risk gauge (ring) ----------
function RiskRing({ score, size = 92 }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = score / 100;
  const color = score >= 70 ? "#dc3545" : score >= 45 ? "#e8652a" : score >= 25 ? "#d9940e" : "#1a9d5e";
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="ring-center"><div className="ring-score" style={{ color }}>{score}</div><div className="ring-of">/ 100</div></div>
    </div>
  );
}

// ---------- Loading / empty / unavailable states (real-data views need these; mocks never did) ----------
function LoadingPanel({ label = "Loading…" }) {
  return <Panel><div className="state-row"><span className="state-spinner" /><span className="dim">{label}</span></div></Panel>;
}
function ErrorPanel({ error, onRetry }) {
  return (
    <Panel>
      <div className="state-row">
        <Icon path={ICONS.alert} size={16} />
        <span>{error?.message || "Something went wrong"}</span>
        {onRetry && <button className="btn-sm" onClick={onRetry}>Retry</button>}
      </div>
    </Panel>
  );
}
function EmptyPanel({ title, sub, action }) {
  return (
    <Panel>
      <div className="state-empty">
        <div className="state-empty-title">{title}</div>
        {sub && <div className="dim sm">{sub}</div>}
        {action}
      </div>
    </Panel>
  );
}
// For views the backend genuinely doesn't implement yet (feed streaming, NLQ,
// counterparty/fund-flow entity modeling) — honest about the gap rather than
// silently falling back to mock data.
function UnavailablePanel({ title, reason }) {
  return (
    <Panel>
      <div className="state-empty">
        <div className="state-empty-title">{title || "Not connected yet"}</div>
        <div className="dim sm" style={{ maxWidth: 480, textAlign: "center" }}>{reason}</div>
      </div>
    </Panel>
  );
}

Object.assign(window, {
  Icon, ICONS, Panel, PanelHead, SevBadge, Tag, Mono, AddrChip, Stat, Sparkline, Meter, RiskRing,
  LoadingPanel, ErrorPanel, EmptyPanel, UnavailablePanel,
});
