// views_analysis.jsx — Tokens, Contracts, Tokenomics→Financials, Infrastructure (real API data)
const { useState: useStateA } = React;

function fmtUsd(n) {
  if (n == null) return "—";
  const v = Number(n);
  return v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "K" : "$" + v.toFixed(0);
}

// ============ TOKEN EXISTENCE & OWNERSHIP ============
function TokensView({ client }) {
  const { data: toks, loading, error, reload } = useApi(`/v1/engagements/${client.id}/tokens`);
  const { data: xc } = useApi(`/v1/engagements/${client.id}/cross-chain`);

  if (loading) return <div className="view"><LoadingPanel label="Loading token holdings…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = toks || [];
  const reconciled = list.filter((t) => t.reconciled).length;

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Token positions" value={list.length} sub="ERC-20 / 721 / 1155" /></Panel>
        <Panel><Stat label="Reconciled" value={`${reconciled}/${list.length}`} tone="#1a9d5e" sub="existence assertion" /></Panel>
        <Panel><Stat label="Unreconciled" value={list.length - reconciled} tone="#d9940e" sub="pending review" /></Panel>
        <Panel><Stat label="Total value" value={fmtUsd(list.reduce((a, t) => a + (Number(t.value_usd) || 0), 0))} sub="sum of value_usd" /></Panel>
      </div>

      {xc && xc.length > 0 && (
        <Panel pad={false} style={{ marginTop: 14 }}>
          <PanelHead icon="chain" title="Cross-chain wallet distribution" sub="Derived from wallets_contracts — no balance reconciliation feed wired up" />
          <div className="xchain-grid">
            {xc.map((c) => (
              <div className="xchain-card ok" key={c.chain}>
                <div className="xchain-name">{c.chain}</div>
                <div className="xchain-meta" style={{ marginTop: 8 }}><span>{c.wallet_count} wallets</span><span>{c.contract_count} contracts</span></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="coins" title="Token holdings & ownership" />
        {list.length === 0 ? (
          <EmptyPanel title="No token holdings recorded" />
        ) : (
          <div className="tok-table">
            <div className="tok-th"><div>Asset</div><div>Standard</div><div>Contract</div><div className="ta-r">Held</div><div className="ta-r">Value</div><div>Custody</div><div>Existence</div></div>
            {list.map((t) => (
              <div className="tok-tr" key={t.id}>
                <div className="tok-asset"><div className="tok-sym">{t.symbol}</div><div className="tok-name">{t.name}</div></div>
                <div>{t.standard && <Tag tone={t.standard === "ERC-20" ? "neutral" : "info"}>{t.standard}</Tag>}</div>
                <div className="tok-contract">{t.contract_address && <AddrChip value={t.contract_address} />}</div>
                <div className="ta-r mono">{t.held}</div>
                <div className="ta-r mono strong">{fmtUsd(t.value_usd)}</div>
                <div className="dim sm">{t.custody}</div>
                <div>{t.reconciled ? <SevBadge sev="info"><span style={{ color: "#1a9d5e" }}>✓ reconciled</span></SevBadge> : <SevBadge sev="medium">review</SevBadge>}</div>
                {t.note && <div className="tok-note">{t.note}</div>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============ SMART-CONTRACT BEHAVIOR ============
function ContractsView({ client }) {
  const { data: cs, loading, error, reload } = useApi(`/v1/engagements/${client.id}/contracts`);
  const [sel, setSel] = useStateA(null);

  if (loading) return <div className="view"><LoadingPanel label="Loading contracts…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = cs || [];
  if (list.length === 0) return <div className="view"><EmptyPanel title="No contracts profiled yet" /></div>;

  const c = list.find((x) => x.id === sel) || list[0];
  const centTone = { High: "#dc3545", Medium: "#d9940e", Low: "#1a9d5e" };

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Contracts in scope" value={list.length} /></Panel>
        <Panel><Stat label="High centralization" value={list.filter((x) => x.centralization === "High").length} tone="#dc3545" /></Panel>
        <Panel><Stat label="Unverified" value={list.filter((x) => !x.verified).length} tone="#d9940e" /></Panel>
        <Panel><Stat label="Multisig-admin" value={list.filter((x) => (x.admin || "").toLowerCase().includes("safe")).length} tone="#1a9d5e" /></Panel>
      </div>

      <div className="grid-1-1" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead icon="contract" title="Contracts" />
          <div className="ctr-list">
            {list.map((x) => (
              <div className={"ctr-row" + (c.id === x.id ? " on" : "")} key={x.id} onClick={() => setSel(x.id)}>
                <div className="ctr-dot" style={{ background: centTone[x.centralization] || "#8896a6" }} />
                <div className="ctr-name">{x.name}{x.address && <div className="ctr-addr mono">{x.address.slice(0, 6)}…{x.address.slice(-4)}</div>}</div>
                {x.severity && <SevBadge sev={x.severity} />}
              </div>
            ))}
          </div>
        </Panel>
        <Panel pad={false}>
          <PanelHead icon="shield" title={c.name} sub={c.proxy_type} right={c.verified ? <Tag tone="ok">verified source</Tag> : <Tag tone="bad">unverified</Tag>} />
          <div className="ctr-detail">
            <div className="cd-grid">
              {c.address && <div><span className="cd-l">Address</span><AddrChip value={c.address} /></div>}
              {c.proxy_type && <div><span className="cd-l">Proxy pattern</span><span>{c.proxy_type}</span></div>}
              {c.admin && <div><span className="cd-l">Admin</span><Mono>{c.admin}</Mono></div>}
              {c.centralization && <div><span className="cd-l">Centralization</span><Tag tone={c.centralization === "High" ? "bad" : c.centralization === "Medium" ? "warn" : "ok"}>{c.centralization}</Tag></div>}
            </div>
            {c.privileges && c.privileges.length > 0 && <>
              <div className="cd-section">Privileged functions</div>
              <div className="cd-privs">{c.privileges.map((p) => <span key={p} className="priv mono">{p}()</span>)}</div>
            </>}
            {c.note && <div className="cd-note"><Icon path={ICONS.alert} size={14} /><span>{c.note}</span></div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ============ TOKENOMICS → FINANCIAL REPORTING ============
function TokenomicsView({ client }) {
  const { data: rows, loading, error, reload } = useApi(`/v1/engagements/${client.id}/tokenomics`);

  if (loading) return <div className="view"><LoadingPanel label="Loading tokenomics events…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = rows || [];
  if (list.length === 0) return <div className="view"><EmptyPanel title="No tokenomics events recorded" /></div>;

  const flagTone = { ok: "ok", review: "warn", alert: "bad" };
  const flagLabel = { ok: "Recognized", review: "Under review", alert: "Adjustment" };
  const byFlag = { ok: 0, review: 0, alert: 0 };
  list.forEach((r) => { byFlag[r.flag] = (byFlag[r.flag] || 0) + (Number(r.amount_usd) || 0); });

  return (
    <div className="view">
      <Panel pad={false}>
        <PanelHead icon="scale" title="Tokenomics → financial reporting bridge" sub="On-chain economic events mapped to accounting treatment & assertions" />
        <div className="bridge-table">
          <div className="br-th"><div>Economic event</div><div>Treatment</div><div>Standard</div><div>Assertion</div><div className="ta-r">Amount</div><div>Status</div></div>
          {list.map((r) => (
            <div className="br-tr" key={r.id}>
              <div className="br-event"><div className="br-event-t">{r.event}</div><div className="br-onchain mono">{r.onchain_desc}</div></div>
              <div className="br-treat">{r.treatment}</div>
              <div>{r.standard && <Tag tone="neutral">{r.standard}</Tag>}</div>
              <div>{r.assertion && <Tag tone="info">{r.assertion}</Tag>}</div>
              <div className="ta-r mono strong">{fmtUsd(r.amount_usd)}</div>
              <div>{r.flag && <Tag tone={flagTone[r.flag]}>{flagLabel[r.flag]}</Tag>}</div>
              {r.note && <div className="br-note">{r.note}</div>}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid-3" style={{ marginTop: 14 }}>
        <Panel pad={false}>
          <PanelHead title="Recognized" sub="flag = ok" />
          <div className="mini-sum"><div className="ms-big">{fmtUsd(byFlag.ok)}</div><div className="ms-cap">sum of amount_usd</div></div>
        </Panel>
        <Panel pad={false}>
          <PanelHead title="Under review" sub="flag = review" />
          <div className="mini-sum"><div className="ms-big">{fmtUsd(byFlag.review)}</div><div className="ms-cap">sum of amount_usd</div></div>
        </Panel>
        <Panel pad={false}>
          <PanelHead title="Adjustments" sub="flag = alert" />
          <div className="mini-sum"><div className="ms-big bad">{fmtUsd(byFlag.alert)}</div><div className="ms-cap">sum of amount_usd</div></div>
        </Panel>
      </div>
    </div>
  );
}

// ============ INFRASTRUCTURE (validators) ============
function InfraView({ client }) {
  const { data: rows, loading, error, reload } = useApi(`/v1/engagements/${client.id}/validators`);

  if (loading) return <div className="view"><LoadingPanel label="Loading validator data…" /></div>;
  if (error) return <div className="view"><ErrorPanel error={error} onRetry={reload} /></div>;

  const list = rows || [];
  if (list.length === 0) return <div className="view"><EmptyPanel title="No validator data recorded" /></div>;
  const v = list[0];

  return (
    <div className="view">
      <div className="grid-4">
        <Panel><Stat label="Active validators" value={v.active_count ?? "—"} sub={v.effective_balance} /></Panel>
        <Panel><Stat label="Attestation rate" value={v.attestation_rate != null ? (Number(v.attestation_rate) * 100).toFixed(2) + "%" : "—"} tone="#1a9d5e" sub={`${v.proposed ?? 0} proposed · ${v.missed ?? 0} missed`} /></Panel>
        <Panel><Stat label="Slashing events" value={v.slashing ?? 0} tone={v.slashing ? "#dc3545" : "#1a9d5e"} /></Panel>
        <Panel><Stat label="MEV reward (FY)" value={v.mev_reward || "—"} /></Panel>
      </div>
      <Panel pad={false} style={{ marginTop: 14 }}>
        <PanelHead icon="server" title="Validator & consensus activity" />
        <div className="infra-list">
          {v.withdrawal_creds && <div className="infra-row"><span>Withdrawal credentials</span><Tag tone="ok">{v.withdrawal_creds}</Tag></div>}
          {v.effective_balance && <div className="infra-row"><span>Effective balance</span><Mono>{v.effective_balance}</Mono></div>}
          {v.note && <div className="infra-note"><Icon path={ICONS.check} size={14} /><span>{v.note}</span></div>}
        </div>
      </Panel>
    </div>
  );
}

Object.assign(window, { TokensView, ContractsView, TokenomicsView, InfraView });
