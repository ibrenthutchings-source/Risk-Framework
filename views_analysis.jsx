// views_analysis.jsx — Tokens, Contracts, Tokenomics→Financials, Infrastructure
const { useState: useStateA } = React;

// ============ TOKEN EXISTENCE & OWNERSHIP ============
function TokensView({ client }) {
  const toks = ADATA.TOKENS;
  const reconciled = toks.filter(t => t.reconciled).length;
  const xc = ADATA.CROSS_CHAIN;
  const fmtUsdXC = (n) => n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : "$" + (n / 1e3).toFixed(0) + "K";
  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Token positions" value={toks.length} sub="ERC-20 / 721 / 1155" /></Panel>
        <Panel><Stat label="Reconciled at block height" value={`${reconciled}/${toks.length}`} tone="#1a9d5e" sub="existence assertion" /></Panel>
        <Panel><Stat label="Unverified contracts" value={toks.filter(t => !t.verified).length} tone="#d9940e" sub="bytecode not published" /></Panel>
        <Panel><Stat label="Custody: multisig" value={toks.filter(t => t.custody.includes("Safe")).length + "/" + toks.length} sub="Gnosis Safe 4/7" /></Panel>
      </div>

      {xc && (
        <Panel pad={false} style={{ marginTop: 14 }}>
          <PanelHead icon="chain" title="Cross-chain reconciliation" sub="Multi-chain balance verification & bridge flows" />
          <div className="xchain-grid">
            {xc.chains.map(c => (
              <div className={"xchain-card " + (c.reconciled ? "ok" : "err")} key={c.chain}>
                <div className="xchain-name">{c.chain}</div>
                <div className="xchain-bal">{fmtUsdXC(c.balanceUsd)}</div>
                <div className="xchain-meta"><span>{c.wallets} wallets</span><span>{c.contracts} contracts</span></div>
                <div className="xchain-meta" style={{ marginTop: 4 }}><span className="mono">block {c.block}</span></div>
                <div className="xchain-status"><Tag tone={c.reconciled ? "ok" : "bad"}>{c.reconciled ? "reconciled" : "Δ " + fmtUsdXC(Math.abs(c.delta))}</Tag></div>
                {!c.reconciled && <div className="xchain-delta" style={{ color: "#dc3545" }}>Unreconciled: {fmtUsdXC(Math.abs(c.delta))}</div>}
              </div>
            ))}
          </div>
          <PanelHead icon="flow" title="Bridge flows" sub="Cross-chain transfers this period" />
          <div className="bridge-rows">
            {xc.bridges.map((b, i) => (
              <div className="bridge-row" key={i}>
                <Tag tone="info">{b.from}</Tag>
                <Icon path={ICONS.arrow} size={13} />
                <Tag tone="info">{b.to}</Tag>
                <span className="dim">{b.bridge}</span>
                <span className="bridge-txn">{b.txCount} txns</span>
                <span className="bridge-amt" style={{ color: "#1a9d5e" }}>{fmtUsdXC(b.amt)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="coins" title="Token holdings & ownership" sub="Balances snapshotted at block #21,847,392 · reconciled to on-chain state" />
        <div className="tok-table">
          <div className="tok-th"><div>Asset</div><div>Standard</div><div>Contract</div><div className="ta-r">Held</div><div className="ta-r">Value</div><div>Custody</div><div>Existence</div></div>
          {toks.map(t => (
            <div className="tok-tr" key={t.symbol}>
              <div className="tok-asset"><div className="tok-sym">{t.symbol}</div><div className="tok-name">{t.name}</div></div>
              <div><Tag tone={t.std === "ERC-20" ? "neutral" : "info"}>{t.std}</Tag></div>
              <div className="tok-contract">
                <AddrChip value={t.contract} />
                {t.verified ? <Tag tone="ok">verified</Tag> : <Tag tone="warn">unverified</Tag>}
              </div>
              <div className="ta-r mono">{t.held}</div>
              <div className="ta-r mono strong">{t.value}</div>
              <div className="dim sm">{t.custody}</div>
              <div>{t.reconciled ? <SevBadge sev="info"><span style={{color:"#1a9d5e"}}>✓ reconciled</span></SevBadge> : <SevBadge sev="medium">review</SevBadge>}</div>
              <div className="tok-note">{t.note}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ============ SMART-CONTRACT BEHAVIOR ============
function ContractsView({ client }) {
  const cs = ADATA.CONTRACTS;
  const [sel, setSel] = useStateA(cs[0].name);
  const c = cs.find(x => x.name === sel);
  const centTone = { High: "#dc3545", Medium: "#d9940e", Low: "#1a9d5e" };
  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Contracts in scope" value={cs.length} sub="proxies & implementations" /></Panel>
        <Panel><Stat label="High centralization" value={cs.filter(x => x.centralization === "High").length} tone="#dc3545" sub="single-key control" /></Panel>
        <Panel><Stat label="Upgradeable" value={cs.filter(x => x.proxy.includes("upgrade")).length} tone="#d9940e" sub="mutable logic" /></Panel>
        <Panel><Stat label="Multisig-gated" value={cs.filter(x => x.admin.includes("Safe")).length} tone="#1a9d5e" sub="of admin functions" /></Panel>
      </div>

      <div className="grid-1-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="contract" title="Contracts" sub="Behavior & control surface" />
          <div className="ctr-list">
            {cs.map(x => (
              <div className={"ctr-row" + (sel === x.name ? " on" : "")} key={x.name} onClick={() => setSel(x.name)}>
                <div className="ctr-dot" style={{ background: centTone[x.centralization] }} />
                <div className="ctr-name">{x.name}<div className="ctr-addr mono">{ADATA.shortAddr(x.address)}</div></div>
                <SevBadge sev={x.severity} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="shield" title={c.name} sub={c.proxy} right={c.verified ? <Tag tone="ok">verified source</Tag> : <Tag tone="bad">unverified</Tag>} />
          <div className="ctr-detail">
            <div className="cd-grid">
              <div><span className="cd-l">Address</span><AddrChip value={c.address} /></div>
              <div><span className="cd-l">Proxy pattern</span><span>{c.proxy}</span></div>
              <div><span className="cd-l">Admin</span><Mono>{c.admin}</Mono></div>
              <div><span className="cd-l">Centralization</span><Tag tone={c.centralization === "High" ? "bad" : c.centralization === "Medium" ? "warn" : "ok"}>{c.centralization}</Tag></div>
            </div>
            <div className="cd-section">Privileged functions</div>
            <div className="cd-privs">
              {c.privileges.map(p => <span key={p} className="priv mono">{p}()</span>)}
            </div>
            <div className="cd-note"><Icon path={ICONS.alert} size={14} /><span>{c.note}</span></div>
          </div>
        </Panel>
      </div>

      {ADATA.CONTRACT_UPGRADES && (
        <Panel pad={false} style={{ marginTop: 14 }}>
          <PanelHead icon="clock" title="Contract upgrade history" sub="Proxy upgrades & parameter mutations this period" />
          <div className="upg-list">
            {ADATA.CONTRACT_UPGRADES.map(u => {
              const riskColor = { critical: "#dc3545", high: "#e8652a", medium: "#d9940e", low: "#1a9d5e" };
              return (
                <div className={"upg-card risk-" + u.risk} key={u.id}>
                  <div className="upg-head">
                    <span className="upg-contract">{u.contract}</span>
                    <span className="upg-type" style={{ color: u.type === "proxy" ? "#8b7cf0" : "#0e7c6b", background: u.type === "proxy" ? "rgba(139,124,240,.12)" : "rgba(86,182,194,.12)" }}>{u.type === "proxy" ? "Proxy upgrade" : "Parameter Δ"}</span>
                    <SevBadge sev={u.risk} />
                    {!u.verified && <Tag tone="bad">unverified</Tag>}
                  </div>
                  {u.oldImpl && (
                    <div className="upg-impl">
                      <span className="mono">{u.oldImpl}</span>
                      <Icon path={ICONS.arrow} size={12} />
                      <span className="mono">{u.newImpl}</span>
                    </div>
                  )}
                  <div className="upg-diff">{u.diff}</div>
                  <div className="upg-foot">
                    <span>{u.note}</span>
                    <span className="mono" style={{ marginLeft: "auto" }}>{u.date} · #{u.block.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ============ TOKENOMICS → FINANCIAL REPORTING ============
function TokenomicsView({ client }) {
  const rows = ADATA.TOKENOMICS;
  const flagTone = { ok: "ok", review: "warn", alert: "bad" };
  const flagLabel = { ok: "Recognized", review: "Under review", alert: "Adjustment" };
  return (
    <div className="view">
      <Panel pad={false}>
        <PanelHead icon="scale" title="Tokenomics → financial reporting bridge"
          sub="Mapping on-chain economic events to accounting treatment & assertions" />
        <div className="bridge-legend">
          <span><span className="bl-dot" style={{ background: "#3b82f6" }} />On-chain economics</span>
          <Icon path={ICONS.arrow} size={14} />
          <span><span className="bl-dot" style={{ background: "#d9940e" }} />Accounting treatment</span>
          <Icon path={ICONS.arrow} size={14} />
          <span><span className="bl-dot" style={{ background: "var(--accent)" }} />FS assertion</span>
        </div>
        <div className="bridge-table">
          <div className="br-th"><div>Economic event (on-chain)</div><div>Accounting treatment</div><div>Standard</div><div>Assertion</div><div className="ta-r">P&L / BS impact</div><div>Status</div></div>
          {rows.map((r, i) => (
            <div className="br-tr" key={i}>
              <div className="br-event"><div className="br-event-t">{r.event}</div><div className="br-onchain mono">{r.onchain}</div></div>
              <div className="br-treat">{r.treatment}</div>
              <div><Tag tone="neutral">{r.standard}</Tag></div>
              <div><Tag tone="info">{r.assertion}</Tag></div>
              <div className="ta-r mono strong">{r.amount}</div>
              <div><Tag tone={flagTone[r.flag]}>{flagLabel[r.flag]}</Tag></div>
              <div className="br-note">{r.note}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid-3" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead title="Revenue recognition" sub="ASC 606 / IFRS 15" />
          <div className="mini-sum">
            <div className="ms-big">$2.81M</div><div className="ms-cap">recognized fees</div>
            <div className="ms-line"><span>Staking rewards (timing)</span><span className="warn">$1.47M ⚠</span></div>
            <div className="ms-line"><span>Token sale (deferred)</span><span className="warn">$3.36M</span></div>
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead title="Liability classification" sub="ASC 480" />
          <div className="mini-sum">
            <div className="ms-big bad">$8.66M</div><div className="ms-cap">unrecorded vesting obligation</div>
            <div className="ms-line"><span>Team vesting (24-mo)</span><span className="bad">off-BS ⚠</span></div>
            <div className="ms-line"><span>Deferred token revenue</span><span>$3.36M</span></div>
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead title="Asset measurement" sub="Fair value / impairment" />
          <div className="mini-sum">
            <div className="ms-big">$84.2M</div><div className="ms-cap">treasury (gross)</div>
            <div className="ms-line"><span>Self-held AUR (exclude)</span><span className="bad">−$36.6M ⚠</span></div>
            <div className="ms-line"><span>Adjusted treasury</span><span className="ok">$47.6M</span></div>
          </div>
        </Panel>
      </div>

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="coins" title="Holder concentration — AUR"
          sub="Ownership distribution drives float, liability classification & impairment risk"
          right={<div className="hc-supply"><span className="dim sm">Supply</span> <span className="mono">{ADATA.HOLDERS.supply}</span> <span className="dim sm">· Circulating</span> <span className="mono">{ADATA.HOLDERS.circulating}</span></div>} />
        <div className="hc-wrap">
          <div className="hc-donuts">
            <Donut pct={ADATA.HOLDERS.metrics.top10} color="#d9940e" value={(ADATA.HOLDERS.metrics.top10 * 100).toFixed(0) + "%"} label="Top 10 holders" />
            <Donut pct={ADATA.HOLDERS.metrics.locked} color="#8b7cf0" value={(ADATA.HOLDERS.metrics.locked * 100).toFixed(0) + "%"} label="Locked / vesting" />
            <Donut pct={ADATA.HOLDERS.metrics.whales} color="#c49000" value={(ADATA.HOLDERS.metrics.whales * 100).toFixed(0) + "%"} label="Whale wallets" />
            <Donut pct={ADATA.HOLDERS.metrics.exchanges} color="#0e7c6b" value={(ADATA.HOLDERS.metrics.exchanges * 100).toFixed(0) + "%"} label="On exchanges" />
          </div>
          <div className="hc-table">
            {ADATA.HOLDERS.rows.map((h, i) => {
              const t = ADATA.ENTITY_TYPES[h.type];
              return (
                <div className="hc-row" key={i}>
                  <div className="hc-name"><EntityDot type={h.type} /><span>{h.label}</span>{h.locked && <Tag tone="info">locked</Tag>}</div>
                  <div className="hc-bar"><div style={{ width: (h.pct / 0.4 * 100) + "%", background: t.color }} /></div>
                  <div className="hc-pct mono">{(h.pct * 100).toFixed(1)}%</div>
                  <div className="hc-amt mono dim">{h.amount}</div>
                  <div className="hc-note dim">{h.note}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ============ INFRASTRUCTURE (validators + custody) ============
function InfraView({ client }) {
  const v = ADATA.VALIDATORS;
  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Active validators" value={v.active} sub={v.effectiveBalance + " effective"} /></Panel>
        <Panel><Stat label="Attestation rate" value={(v.attestationRate * 100).toFixed(2) + "%"} tone="#1a9d5e" sub={`${v.proposed} proposed · ${v.missed} missed`} /></Panel>
        <Panel><Stat label="Slashing events" value={v.slashing} tone={v.slashing ? "#dc3545" : "#1a9d5e"} sub="penalty history" /></Panel>
        <Panel><Stat label="MEV reward (FY)" value={v.mevReward} sub="recognize as revenue" /></Panel>
      </div>

      <div className="grid-1-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="server" title="Validator & consensus activity" sub="Beacon chain attestation & rewards" />
          <div className="infra-list">
            <div className="infra-row"><span>Withdrawal credentials</span><Tag tone="ok">{v.withdrawalCreds}</Tag></div>
            <div className="infra-row"><span>Effective balance</span><Mono>{v.effectiveBalance}</Mono></div>
            <div className="infra-row"><span>Blocks proposed</span><Mono>{v.proposed}</Mono></div>
            <div className="infra-row"><span>Attestations missed</span><Mono>{v.missed}</Mono></div>
            <div className="infra-note"><Icon path={ICONS.check} size={14} /><span>{v.note}</span></div>
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="shield" title="Key custody & wallet health" sub="Control attestation" />
          <div className="cust-list">
            <div className="cust-row"><div className="cust-l"><div className="cust-name">Treasury Safe</div><Mono dim>Gnosis Safe · 4-of-7</Mono></div><Tag tone="ok">healthy</Tag></div>
            <div className="cust-row"><div className="cust-l"><div className="cust-name">Operations EOA</div><Mono dim>Single key · hot</Mono></div><Tag tone="warn">SPOF risk</Tag></div>
            <div className="cust-row"><div className="cust-l"><div className="cust-name">Cold reserve</div><Mono dim>Hardware · offline</Mono></div><Tag tone="ok">segregated</Tag></div>
            <div className="cust-row"><div className="cust-l"><div className="cust-name">RewardsDistributor admin</div><Mono dim>EOA · unverified</Mono></div><Tag tone="bad">centralized</Tag></div>
            <div className="cust-bar"><span>Cold / hot segregation</span><div style={{ flex: 1 }}><Meter pct={0.72} color="#1a9d5e" /></div><span className="mono">72%</span></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

Object.assign(window, { TokensView, ContractsView, TokenomicsView, InfraView });
