// components_intel.jsx — EntityLabel, EntityDot, ProfilerDrawer, Sankey, ConcentrationDonut, Switch
const { useState: useStateI, useEffect: useEffectI } = React;

// ---------- Entity dot + label ----------
function EntityDot({ type, size = 8 }) {
  const t = ADATA.ENTITY_TYPES[type] || ADATA.ENTITY_TYPES.unknown;
  return <span style={{ width: size, height: size, borderRadius: type === "contract" ? 2 : "50%", background: t.color, flex: "0 0 auto", display: "inline-block" }} />;
}
function openProfiler(entity) { if (entity) window.dispatchEvent(new CustomEvent("open-profiler", { detail: entity })); }

function EntityLabel({ entity, address, compact }) {
  const e = entity || (address ? ADATA.resolveEntity(address) : null);
  if (!e) {
    return <span className="ent-label unlabeled" onClick={() => address && navigator.clipboard?.writeText(address)}>
      <EntityDot type="unknown" /><span className="mono">{address ? ADATA.shortAddr(address) : "—"}</span>
    </span>;
  }
  const t = ADATA.ENTITY_TYPES[e.type];
  const risky = e.type === "mixer" || e.type === "sanctioned" || e.risk === "critical" || e.risk === "high";
  return (
    <button className={"ent-label" + (risky ? " risky" : "")} onClick={() => openProfiler(e)} title={t.label}>
      <EntityDot type={e.type} />
      <span className="ent-name">{e.name}</span>
      {!compact && <span className="ent-type" style={{ color: t.color, borderColor: t.color + "44", background: t.color + "16" }}>{t.short}</span>}
    </button>
  );
}

// ---------- Wallet profiler drawer ----------
function ProfilerDrawer() {
  const [entity, setEntity] = useStateI(null);
  const [closing, setClosing] = useStateI(false);
  useEffectI(() => {
    const open = (e) => { setClosing(false); setEntity(e.detail); };
    window.addEventListener("open-profiler", open);
    return () => window.removeEventListener("open-profiler", open);
  }, []);
  if (!entity) return null;
  const t = ADATA.ENTITY_TYPES[entity.type];
  const close = () => { setClosing(true); setTimeout(() => setEntity(null), 200); };
  // derive counterparties
  const cps = ADATA.ENTITIES.filter(x => x.id !== entity.id).slice(2, 7);
  const spark = [12, 18, 9, 22, 31, 19, 27, 35, 24, 30];
  const fmt = (n) => n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "K" : "$" + n;

  return (
    <div className={"drawer-scrim" + (closing ? " out" : "")} onClick={close}>
      <aside className={"drawer" + (closing ? " out" : "")} onClick={(ev) => ev.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-id">
            <span className="drawer-av" style={{ background: t.color + "1f", borderColor: t.color + "55", color: t.color }}><EntityDot type={entity.type} size={12} /></span>
            <div>
              <div className="drawer-name">{entity.name}</div>
              <div className="drawer-type" style={{ color: t.color }}>{t.label}</div>
            </div>
          </div>
          <button className="drawer-x" onClick={close}>✕</button>
        </div>

        <div className="drawer-body">
          {(entity.type === "mixer" || entity.type === "sanctioned") &&
            <div className="drawer-warn"><Icon path={ICONS.alert} size={15} /><span>{entity.type === "sanctioned" ? "Sanctioned entity — any direct exposure is reportable." : "Tagged mixer — source-of-funds documentation required."}</span></div>}

          <div className="drawer-addr"><span className="cd-l">Address</span><AddrChip value={entity.address} /></div>

          <div className="drawer-stats">
            <div><div className="ds-label">Balance</div><div className="ds-val sm">{entity.balanceUsd ? fmt(entity.balanceUsd) : "—"}</div></div>
            <div><div className="ds-label">Wallet age</div><div className="ds-val sm">{entity.ageDays}d</div></div>
            <div><div className="ds-label">Txns</div><div className="ds-val sm">{entity.txCount.toLocaleString()}</div></div>
          </div>

          <div className="drawer-sec">Activity (30d)</div>
          <Sparkline data={spark} w={336} h={44} />

          <div className="drawer-sec">Risk tags</div>
          <div className="drawer-tags">
            {entity.risk && <Tag tone={entity.risk === "critical" || entity.risk === "high" ? "bad" : entity.risk === "med" ? "warn" : "neutral"}>{entity.risk} risk</Tag>}
            {entity.tags.map(tg => <Tag key={tg}>{tg}</Tag>)}
          </div>

          <div className="drawer-sec">Top counterparties</div>
          <div className="drawer-cps">
            {cps.map(c => (
              <button key={c.id} className="drawer-cp" onClick={() => openProfiler(c)}>
                <EntityDot type={c.type} /><span className="drawer-cp-name">{c.name}</span>
                <span className="drawer-cp-type" style={{ color: ADATA.ENTITY_TYPES[c.type].color }}>{ADATA.ENTITY_TYPES[c.type].short}</span>
              </button>
            ))}
          </div>

          <div className="drawer-note"><span className="cd-l">Analyst note</span>{entity.note}</div>
        </div>

        <div className="drawer-foot">
          <button className="btn-export"><Icon path={ICONS.copy} size={14} /> Add to workpaper</button>
          <button className="btn-sm">Trace funds</button>
        </div>
      </aside>
    </div>
  );
}

// ---------- Sankey helpers ----------
function fmtUsd(n) { return n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(0) + "K" : "$" + (n || 0); }

// Collect every link & node on a flow path THROUGH `id` (upstream sources + downstream sinks)
function traceLineage(links, id) {
  const linkSet = new Set(), nodeSet = new Set([id]);
  const seenU = new Set([id]); let f = [id];
  while (f.length) { const cur = f.pop(); links.forEach((l, i) => { if (l.t === cur) { linkSet.add(i); if (!seenU.has(l.s)) { seenU.add(l.s); nodeSet.add(l.s); f.push(l.s); } } }); }
  const seenD = new Set([id]); f = [id];
  while (f.length) { const cur = f.pop(); links.forEach((l, i) => { if (l.s === cur) { linkSet.add(i); if (!seenD.has(l.t)) { seenD.add(l.t); nodeSet.add(l.t); f.push(l.t); } } }); }
  return { linkSet, nodeSet };
}

// ---------- Sankey ----------
function Sankey({ data, height = 360, activeId = null, selectedId = null, onHover = () => {}, onSelect = () => {} }) {
  const [tip, setTip] = useStateI(null);
  const wrapRef = React.useRef(null);
  const W = 820, H = height, padX = 8, padY = 10, gap = 18;
  const cols = {};
  data.nodes.forEach(n => { (cols[n.col] = cols[n.col] || []).push(n); });
  const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b);
  const maxCol = Math.max(...colKeys);
  const val = {};
  data.nodes.forEach(n => {
    const out = data.links.filter(l => l.s === n.id).reduce((a, l) => a + l.amt, 0);
    const inc = data.links.filter(l => l.t === n.id).reduce((a, l) => a + l.amt, 0);
    val[n.id] = Math.max(out, inc, 1);
  });
  let maxTotal = 0, maxCount = 1;
  colKeys.forEach(c => { const tot = cols[c].reduce((a, n) => a + val[n.id], 0); if (tot > maxTotal) maxTotal = tot; maxCount = Math.max(maxCount, cols[c].length); });
  const scale = (H - 2 * padY - (maxCount - 1) * gap) / maxTotal;
  const nodeW = 13;
  const pos = {};
  colKeys.forEach(c => {
    const list = cols[c];
    const tot = list.reduce((a, n) => a + val[n.id] * scale, 0) + (list.length - 1) * gap;
    let y = padY + (H - 2 * padY - tot) / 2;
    const x = padX + (c / maxCol) * (W - 2 * padX - nodeW);
    list.forEach(n => { const h = val[n.id] * scale; pos[n.id] = { x, y, h, outAcc: 0, inAcc: 0 }; y += h + gap; });
  });
  // precompute link geometry (single accumulation pass so ribbons stack correctly)
  const linkGeo = data.links.map((l, i) => {
    const sp = pos[l.s], tp = pos[l.t]; if (!sp || !tp) return null;
    const th = Math.max(2, l.amt * scale);
    const y0 = sp.y + sp.outAcc + th / 2; sp.outAcc += th;
    const y1 = tp.y + tp.inAcc + th / 2; tp.inAcc += th;
    const x0 = sp.x + nodeW, x1 = tp.x, mx = (x0 + x1) / 2;
    return { i, l, th, x0, y0, x1, y1, mx, d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}` };
  });

  const trace = activeId ? traceLineage(data.links, activeId) : null;
  const linkActive = (i) => !trace || trace.linkSet.has(i);
  const nodeActive = (id) => !trace || trace.nodeSet.has(id);

  const place = (e, obj) => {
    const r = wrapRef.current ? wrapRef.current.getBoundingClientRect() : { left: 0, top: 0 };
    return { ...obj, x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const moveTip = (e) => { if (wrapRef.current) { const r = wrapRef.current.getBoundingClientRect(); setTip(t => t ? { ...t, x: e.clientX - r.left, y: e.clientY - r.top } : t); } };
  const nodeTip = (n) => {
    const inc = data.links.filter(l => l.t === n.id).reduce((a, l) => a + l.amt, 0);
    const out = data.links.filter(l => l.s === n.id).reduce((a, l) => a + l.amt, 0);
    return { kind: "node", title: n.label, type: n.type, inc, out };
  };

  return (
    <div className="sankey-stage" ref={wrapRef} onMouseMove={moveTip} onMouseLeave={() => { setTip(null); onHover(null); }}>
      <svg className="sankey" viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <rect x={0} y={0} width={W} height={H} fill="transparent" onClick={() => onSelect(null)} />
        {linkGeo.map(g => {
          if (!g) return null;
          const c = ADATA.SEVERITY[g.l.risk] ? ADATA.SEVERITY[g.l.risk].color : "#1a9d5e";
          const act = linkActive(g.i);
          return (
            <path key={"lk" + g.i} d={g.d} stroke={c} strokeWidth={g.th} fill="none"
              opacity={trace ? (act ? 0.66 : 0.05) : 0.32}
              style={{ transition: "opacity .18s", cursor: "pointer" }}
              onMouseEnter={(e) => setTip(place(e, { kind: "link", s: g.l.s, t: g.l.t, amt: g.l.amt, risk: g.l.risk }))}
              onMouseLeave={() => setTip(null)} />
          );
        })}
        {trace && linkGeo.map(g => g && linkActive(g.i) && (
          <text key={"la" + g.i} x={g.mx} y={(g.y0 + g.y1) / 2 - 3} textAnchor="middle"
            fill="#cdd9e8" fontSize="10.5" fontWeight="600" fontFamily="var(--mono)" style={{ pointerEvents: "none" }}>{fmtUsd(g.l.amt)}</text>
        ))}
        {data.nodes.map(n => {
          const p = pos[n.id]; const t = ADATA.ENTITY_TYPES[n.type];
          const labelLeft = n.col < maxCol;
          const act = nodeActive(n.id);
          const sel = selectedId === n.id;
          return (
            <g key={n.id} style={{ cursor: "pointer", transition: "opacity .18s" }} opacity={act ? 1 : 0.2}
              onMouseEnter={(e) => { setTip(place(e, nodeTip(n))); onHover(n.id); }}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => { e.stopPropagation(); onSelect(sel ? null : n.id); }}>
              {sel && <rect x={p.x - 4} y={p.y - 4} width={nodeW + 8} height={p.h + 8} rx={5} fill="none" stroke={t.color} strokeWidth="1.6" opacity="0.95" />}
              <rect x={p.x} y={p.y} width={nodeW} height={p.h} rx={3} fill={t.color} />
              <text x={labelLeft ? p.x + nodeW + 7 : p.x - 7} y={p.y + p.h / 2 - 3} textAnchor={labelLeft ? "start" : "end"}
                fill="var(--txt)" fontSize="12.5" fontWeight="600" dominantBaseline="middle" style={{ pointerEvents: "none" }}>{n.label}</text>
              <text x={labelLeft ? p.x + nodeW + 7 : p.x - 7} y={p.y + p.h / 2 + 11} textAnchor={labelLeft ? "start" : "end"}
                fill={t.color} fontSize="10.5" dominantBaseline="middle" style={{ pointerEvents: "none" }}>{fmtUsd(val[n.id])}</text>
            </g>
          );
        })}
      </svg>
      {tip && <SankeyTip tip={tip} />}
    </div>
  );
}

// ---------- Sankey tooltip ----------
function SankeyTip({ tip }) {
  const style = { left: tip.x, top: tip.y };
  if (tip.kind === "node") {
    const t = ADATA.ENTITY_TYPES[tip.type] || ADATA.ENTITY_TYPES.unknown;
    const role = tip.inc && tip.out ? "Pass-through" : tip.out ? "Source" : "Destination";
    return (
      <div className="sankey-tip" style={style}>
        <div className="stip-head"><EntityDot type={tip.type} /><b>{tip.title}</b><span style={{ color: t.color }}>{t.short}</span></div>
        <div className="stip-rows">
          <div><span>Inflow</span><b className="mono">{tip.inc ? fmtUsd(tip.inc) : "—"}</b></div>
          <div><span>Outflow</span><b className="mono">{tip.out ? fmtUsd(tip.out) : "—"}</b></div>
          <div><span>Role</span><b>{role}</b></div>
        </div>
      </div>
    );
  }
  const sE = ADATA.ENTITY_BY_ID[tip.s], tE = ADATA.ENTITY_BY_ID[tip.t];
  const c = ADATA.SEVERITY[tip.risk] ? ADATA.SEVERITY[tip.risk].color : "#1a9d5e";
  return (
    <div className="sankey-tip" style={style}>
      <div className="stip-head"><b>{sE ? sE.name : tip.s}</b><span style={{ color: "var(--dim)" }}>→</span><b>{tE ? tE.name : tip.t}</b></div>
      <div className="stip-link-amt mono" style={{ color: c }}>{fmtUsd(tip.amt)}</div>
      {tip.risk && <div className="stip-rows"><div><span>Risk on hop</span><b style={{ color: c, textTransform: "capitalize" }}>{tip.risk}</b></div></div>}
    </div>
  );
}

// ---------- Concentration donut ----------
function Donut({ pct, color = "var(--accent)", size = 78, label, value }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  return (
    <div className="donut" style={{ width: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .7s ease" }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill="var(--txt)" fontSize="16" fontWeight="600" fontFamily="var(--mono)">{value}</text>
      </svg>
      <div className="donut-label">{label}</div>
    </div>
  );
}

// ---------- Toggle switch ----------
function Switch({ on, onChange, color = "var(--accent)" }) {
  return (
    <button className={"switch" + (on ? " on" : "")} onClick={() => onChange(!on)} style={on ? { background: color, borderColor: color } : {}}>
      <span className="switch-knob" />
    </button>
  );
}

Object.assign(window, { EntityDot, EntityLabel, ProfilerDrawer, Sankey, SankeyTip, Donut, Switch, openProfiler, fmtUsd, traceLineage });
