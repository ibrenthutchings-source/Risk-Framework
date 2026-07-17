// dune_integration.jsx — Simulated Dune MCP integration for audit queries
const { useState: useStateD, useEffect: useEffectD, useRef: useRefD, useCallback: useCallbackD } = React;

// ---- Simulated Dune MCP connection ----
const DUNE_MCP = {
  endpoint: "https://api.dune.com/mcp/v1",
  apiKey: "t8QjLN2flIyRNjRAktMdLalOWVd7aOLb",
  status: "connected",
  version: "2024.6.1",
  credits: { used: 142, limit: 2500, plan: "Plus" },
};

// ---- Pre-built audit queries with SQL + mock results ----
const DUNE_QUERIES = [
  {
    id: 4093878, name: "AUR token holder concentration",
    desc: "Top holders of AUR token — assess concentration risk for Existence & Valuation assertions",
    category: "Existence", engine: "Trino",
    sql: `SELECT\n  address,\n  balance / 1e18 AS balance_aur,\n  balance / 1e18 / total_supply * 100 AS pct_supply,\n  CASE\n    WHEN label IS NOT NULL THEN label\n    ELSE CONCAT('0x', SUBSTR(CAST(address AS VARCHAR), 3, 6), '…')\n  END AS entity_label\nFROM erc20_ethereum.balances\nLEFT JOIN labels.addresses ON address = addresses.address\nWHERE token_address = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9\n  AND balance > 0\nORDER BY balance DESC\nLIMIT 15;`,
    mockResults: {
      execution_id: "01HZK8M3V2QWERTY12345",
      started_at: "2026-06-09T14:22:08.412Z",
      ended_at: "2026-06-09T14:22:11.847Z",
      rows_scanned: 847291,
      credits_used: 8,
      columns: ["address", "balance_aur", "pct_supply", "entity_label"],
      rows: [
        { address: "0x6687c2...3835", balance_aur: 18420000, pct_supply: 18.42, entity_label: "Treasury Safe (Aurora)" },
        { address: "0x3c44Cd...4B48", balance_aur: 11400000, pct_supply: 11.40, entity_label: "Vesting Contract" },
        { address: "0x28C6c0...6eA2", balance_aur: 8200000, pct_supply: 8.20, entity_label: "Binance 14 (Hot)" },
        { address: "0x1a2b3c...4d5e", balance_aur: 6800000, pct_supply: 6.80, entity_label: "StakingVault" },
        { address: "0xDef1C0...d5F3", balance_aur: 4100000, pct_supply: 4.10, entity_label: "Uniswap V3: AUR-USDC" },
        { address: "0x4a83E6...2c1f", balance_aur: 3200000, pct_supply: 3.20, entity_label: "Coinbase Prime" },
        { address: "0xf977a1...8b3d", balance_aur: 2900000, pct_supply: 2.90, entity_label: "Wintermute" },
        { address: "0x8832e1...a0c4", balance_aur: 2100000, pct_supply: 2.10, entity_label: "0x8832e1…" },
        { address: "0x55d398...E857", balance_aur: 1840000, pct_supply: 1.84, entity_label: "RewardsDistributor" },
        { address: "0xab12cd...ef34", balance_aur: 1200000, pct_supply: 1.20, entity_label: "0xab12cd…" },
      ],
    },
  },
  {
    id: 3589974, name: "Aurora Protocol DEX liquidity",
    desc: "AUR token liquidity across DEXes — valuation measurement & slippage risk",
    category: "Valuation", engine: "Trino",
    sql: `SELECT\n  project AS dex,\n  pair,\n  SUM(amount_usd) AS volume_24h,\n  AVG(amount_usd) AS avg_trade_size,\n  COUNT(*) AS trade_count,\n  MIN(block_time) AS first_trade,\n  MAX(block_time) AS last_trade\nFROM dex.trades\nWHERE (token_bought_address = 0x7Fc665...DDaE9\n   OR token_sold_address = 0x7Fc665...DDaE9)\n  AND block_time > NOW() - INTERVAL '24' HOUR\nGROUP BY 1, 2\nORDER BY volume_24h DESC;`,
    mockResults: {
      execution_id: "01HZK8N4W3ASDFGH67890",
      started_at: "2026-06-09T14:22:14.100Z",
      ended_at: "2026-06-09T14:22:18.423Z",
      rows_scanned: 1284019,
      credits_used: 12,
      columns: ["dex", "pair", "volume_24h", "avg_trade_size", "trade_count", "first_trade", "last_trade"],
      rows: [
        { dex: "Uniswap V3", pair: "AUR/USDC", volume_24h: 4280000, avg_trade_size: 12400, trade_count: 345, first_trade: "2026-06-08 14:22", last_trade: "2026-06-09 14:18" },
        { dex: "Uniswap V3", pair: "AUR/WETH", volume_24h: 2140000, avg_trade_size: 18200, trade_count: 118, first_trade: "2026-06-08 14:31", last_trade: "2026-06-09 14:12" },
        { dex: "Curve", pair: "AUR/USDC/USDT", volume_24h: 890000, avg_trade_size: 42800, trade_count: 21, first_trade: "2026-06-08 15:10", last_trade: "2026-06-09 13:44" },
        { dex: "Balancer V2", pair: "AUR/WETH/USDC", volume_24h: 410000, avg_trade_size: 8200, trade_count: 50, first_trade: "2026-06-08 14:55", last_trade: "2026-06-09 13:58" },
        { dex: "1inch", pair: "AUR/USDC (agg)", volume_24h: 320000, avg_trade_size: 6100, trade_count: 52, first_trade: "2026-06-08 16:02", last_trade: "2026-06-09 14:02" },
      ],
    },
  },
  {
    id: 2030664, name: "Client wallet gas expenditure",
    desc: "Gas fees paid by Aurora Protocol wallets — operational cost classification",
    category: "Presentation", engine: "Spark SQL",
    sql: `SELECT\n  "from" AS wallet,\n  label,\n  COUNT(*) AS tx_count,\n  SUM(gas_used * gas_price / 1e18) AS eth_spent,\n  SUM(gas_used * gas_price / 1e18 * p.price) AS usd_spent,\n  AVG(gas_price / 1e9) AS avg_gwei\nFROM ethereum.transactions t\nJOIN prices.usd p ON p.symbol = 'ETH'\n  AND p.minute = DATE_TRUNC('minute', t.block_time)\nLEFT JOIN labels.addresses l ON t."from" = l.address\nWHERE "from" IN (\n  0x6687c2...3835, -- Treasury Safe\n  0x9f3a...E1,    -- Ops EOA\n  0x4a83...1fa0   -- Deployer\n)\n  AND block_time > NOW() - INTERVAL '30' DAY\nGROUP BY 1, 2\nORDER BY usd_spent DESC;`,
    mockResults: {
      execution_id: "01HZK8P5X4ZXCVBN09876",
      started_at: "2026-06-09T14:22:22.710Z",
      ended_at: "2026-06-09T14:22:29.156Z",
      rows_scanned: 2841092,
      credits_used: 18,
      columns: ["wallet", "label", "tx_count", "eth_spent", "usd_spent", "avg_gwei"],
      rows: [
        { wallet: "0x6687c2...3835", label: "Treasury Safe", tx_count: 142, eth_spent: 2.841, usd_spent: 8942, avg_gwei: 14.2 },
        { wallet: "0x9f3a...E1", label: "Ops EOA", tx_count: 891, eth_spent: 8.42, usd_spent: 26481, avg_gwei: 18.7 },
        { wallet: "0x4a83...1fa0", label: "Deployer EOA", tx_count: 24, eth_spent: 1.204, usd_spent: 3788, avg_gwei: 22.1 },
      ],
    },
  },
  {
    id: 3237721, name: "Stablecoin reserve composition",
    desc: "USDC/USDT/DAI held in Aurora vaults — valuation & existence cross-check",
    category: "Valuation", engine: "Trino",
    sql: `SELECT\n  token_symbol,\n  token_address,\n  SUM(balance / POWER(10, decimals)) AS total_balance,\n  COUNT(DISTINCT wallet) AS wallet_count,\n  MAX(last_transfer) AS last_movement\nFROM (\n  SELECT *\n  FROM erc20_ethereum.balances\n  WHERE wallet IN (\n    SELECT address FROM aurora_protocol.wallets\n  )\n  AND token_address IN (\n    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, -- USDC\n    0xdAC17F958D2ee523a2206206994597C13D831ec7, -- USDT\n    0x6B175474E89094C44Da98b954EedeAC495271d0F  -- DAI\n  )\n)\nGROUP BY 1, 2\nORDER BY total_balance DESC;`,
    mockResults: {
      execution_id: "01HZK8Q6Y5MNBVCX54321",
      started_at: "2026-06-09T14:22:32.400Z",
      ended_at: "2026-06-09T14:22:35.812Z",
      rows_scanned: 412840,
      credits_used: 6,
      columns: ["token_symbol", "token_address", "total_balance", "wallet_count", "last_movement"],
      rows: [
        { token_symbol: "USDC", token_address: "0xA0b8...eB48", total_balance: 28100000, wallet_count: 6, last_movement: "2026-06-09 11:42" },
        { token_symbol: "USDT", token_address: "0xdAC1...1ec7", total_balance: 3800000, wallet_count: 3, last_movement: "2026-06-08 18:22" },
        { token_symbol: "DAI", token_address: "0x6B17...1d0F", total_balance: 420000, wallet_count: 2, last_movement: "2026-06-07 09:14" },
      ],
    },
  },
  {
    id: 3296308, name: "Bridge transfers reconciliation",
    desc: "All bridge deposits & withdrawals for Aurora wallets — completeness assertion",
    category: "Completeness", engine: "Trino",
    sql: `SELECT\n  bridge_name,\n  source_chain,\n  destination_chain,\n  token_symbol,\n  SUM(amount_usd) AS total_usd,\n  COUNT(*) AS tx_count,\n  SUM(CASE WHEN status = 'confirmed' THEN amount_usd ELSE 0 END) AS confirmed_usd,\n  SUM(CASE WHEN status = 'pending' THEN amount_usd ELSE 0 END) AS pending_usd\nFROM bridge.transfers\nWHERE sender IN (SELECT address FROM aurora_protocol.wallets)\n   OR receiver IN (SELECT address FROM aurora_protocol.wallets)\nGROUP BY 1, 2, 3, 4\nORDER BY total_usd DESC;`,
    mockResults: {
      execution_id: "01HZK8R7Z6LKJHGF21098",
      started_at: "2026-06-09T14:22:38.100Z",
      ended_at: "2026-06-09T14:22:42.534Z",
      rows_scanned: 982401,
      credits_used: 10,
      columns: ["bridge_name", "source_chain", "destination_chain", "token_symbol", "total_usd", "tx_count", "confirmed_usd", "pending_usd"],
      rows: [
        { bridge_name: "Arbitrum Bridge", source_chain: "Ethereum", destination_chain: "Arbitrum", token_symbol: "USDC", total_usd: 4800000, tx_count: 61, confirmed_usd: 4800000, pending_usd: 0 },
        { bridge_name: "Arbitrum Bridge", source_chain: "Arbitrum", destination_chain: "Ethereum", token_symbol: "USDC", total_usd: 1200000, tx_count: 23, confirmed_usd: 1200000, pending_usd: 0 },
        { bridge_name: "Polygon PoS", source_chain: "Ethereum", destination_chain: "Polygon", token_symbol: "USDC", total_usd: 890000, tx_count: 14, confirmed_usd: 875800, pending_usd: 14200 },
        { bridge_name: "Polygon PoS", source_chain: "Polygon", destination_chain: "Ethereum", token_symbol: "AUR", total_usd: 220000, tx_count: 4, confirmed_usd: 220000, pending_usd: 0 },
      ],
    },
  },
  {
    id: 4102991, name: "Mixer & sanctioned address screening",
    desc: "Scan inbound transfers for OFAC / mixer / tornado exposure — AML compliance",
    category: "Completeness", engine: "Trino",
    sql: `SELECT\n  t.hash AS tx_hash,\n  t."from" AS sender,\n  l.label AS sender_label,\n  t.value / 1e18 AS eth_value,\n  CASE\n    WHEN l.category = 'sanctioned' THEN 'OFAC SDN'\n    WHEN l.category = 'mixer' THEN 'Mixer'\n    WHEN l.name ILIKE '%tornado%' THEN 'Tornado Cash'\n    ELSE l.category\n  END AS risk_type,\n  t.block_time\nFROM ethereum.transactions t\nJOIN labels.addresses l ON t."from" = l.address\nWHERE t."to" IN (SELECT address FROM aurora_protocol.wallets)\n  AND l.category IN ('sanctioned', 'mixer', 'high_risk')\n  AND t.block_time > NOW() - INTERVAL '90' DAY\nORDER BY t.block_time DESC;`,
    mockResults: {
      execution_id: "01HZK8S8A7POIUYT65432",
      started_at: "2026-06-09T14:22:46.200Z",
      ended_at: "2026-06-09T14:22:51.891Z",
      rows_scanned: 4218402,
      credits_used: 22,
      columns: ["tx_hash", "sender", "sender_label", "eth_value", "risk_type", "block_time"],
      rows: [
        { tx_hash: "0x3b91...0c4d", sender: "0xd90e...BDdA", sender_label: "Tornado Cash Router", eth_value: 89.2, risk_type: "Tornado Cash", block_time: "2026-06-04 08:42" },
        { tx_hash: "0x77ad...9e21", sender: "0xd90e...BDdA", sender_label: "Tornado Cash Router", eth_value: 44.1, risk_type: "Tornado Cash", block_time: "2026-06-04 08:38" },
        { tx_hash: "0xcc12...4f1b", sender: "0x1209...a3Bf", sender_label: "OFAC Flagged Wallet", eth_value: 12.4, risk_type: "OFAC SDN", block_time: "2026-05-28 22:10" },
      ],
    },
  },
];

// ---- Simulated execution engine (staged transitions) ----
async function simulateDuneExecution(query, onStatus, onLog) {
  const stages = [
    { state: "queued", label: "Queued", delay: 400, log: `[MCP] POST /api/v1/query/${query.id}/execute` },
    { state: "queued", label: "Queued", delay: 300, log: `[MCP] Response: execution_id=${query.mockResults.execution_id}` },
    { state: "executing", label: "Executing", delay: 600, log: `[${query.engine}] Compiling query plan…` },
    { state: "executing", label: "Executing", delay: 800, log: `[${query.engine}] Scanning ${query.mockResults.rows_scanned.toLocaleString()} rows…` },
    { state: "executing", label: "Executing", delay: 500, log: `[${query.engine}] Aggregating results…` },
    { state: "completed", label: "Complete", delay: 200, log: `[MCP] GET /api/v1/execution/${query.mockResults.execution_id}/results` },
    { state: "done", label: "Complete", delay: 100, log: `[MCP] ${query.mockResults.rows.length} rows returned · ${query.mockResults.credits_used} credits used` },
  ];
  for (const s of stages) {
    await new Promise(r => setTimeout(r, s.delay));
    onStatus(s.state);
    onLog(l => [...l, s.log]);
  }
  return query.mockResults;
}

// ---- Dune MCP Panel ----
function DunePanel() {
  const [selQuery, setSelQuery] = useStateD(DUNE_QUERIES[0]);
  const [status, setStatus] = useStateD("idle");
  const [results, setResults] = useStateD(null);
  const [logs, setLogs] = useStateD([]);
  const [showLogs, setShowLogs] = useStateD(false);
  const [showSql, setShowSql] = useStateD(true);
  const logEndRef = useRefD(null);
  const totalCredits = DUNE_QUERIES.reduce((a, q) => a + q.mockResults.credits_used, 0);

  useEffectD(() => { if (logEndRef.current) logEndRef.current.scrollTop = logEndRef.current.scrollHeight; }, [logs]);

  const run = useCallbackD(async () => {
    setStatus("queued");
    setResults(null);
    setLogs([`[MCP] Connecting to ${DUNE_MCP.endpoint}…`, `[MCP] Authenticated · plan=${DUNE_MCP.credits.plan} · credits=${DUNE_MCP.credits.used}/${DUNE_MCP.credits.limit}`]);
    const data = await simulateDuneExecution(selQuery, setStatus, setLogs);
    setResults(data);
  }, [selQuery]);

  const selectQuery = (q) => { setSelQuery(q); setResults(null); setStatus("idle"); setLogs([]); };

  const cols = results?.columns || [];
  const rows = results?.rows || [];

  const statusColor = { idle: "var(--dim)", queued: "#8b7cf0", executing: "#3b82f6", completed: "#1a9d5e", done: "#1a9d5e", error: "#dc3545" };
  const statusIcon = { idle: "○", queued: "◌", executing: "◑", completed: "●", done: "●" };
  const statusLabel = { idle: "Ready", queued: "Queued", executing: "Executing…", completed: "Complete", done: "Complete" };

  const fmtCell = (v) => {
    if (v == null) return "—";
    if (typeof v === "number" && v >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (typeof v === "number" && v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (typeof v === "number" && v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    if (typeof v === "number") return v % 1 ? v.toFixed(2) : String(v);
    if (typeof v === "string" && v.length > 42) return v.slice(0, 40) + "…";
    return String(v);
  };

  const elapsed = results ? ((new Date(results.ended_at) - new Date(results.started_at)) / 1000).toFixed(1) : null;

  return (
    <Panel pad={false} style={{ marginTop: 14 }}>
      <div className="dune-header">
        <div className="dune-header-l">
          <div className="dune-logo">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d9940e" strokeWidth="2" strokeLinecap="round"><path d="M3 17c3-6 6-10 9-10s6 4 9 10"/><path d="M3 20h18"/><circle cx="12" cy="10" r="2" fill="#d9940e" stroke="none"/></svg>
          </div>
          <div>
            <div className="dune-header-title">Dune Analytics <span className="dune-mcp-badge">MCP</span></div>
            <div className="dune-header-sub">Connected via <span className="mono">dune-mcp/v1</span> · {DUNE_MCP.credits.plan} plan</div>
          </div>
        </div>
        <div className="dune-header-r">
          <div className="dune-credit-meter">
            <div className="dune-credit-bar"><div style={{ width: (DUNE_MCP.credits.used / DUNE_MCP.credits.limit * 100) + "%" }}></div></div>
            <span className="mono dim" style={{ fontSize: 10.5 }}>{DUNE_MCP.credits.used}/{DUNE_MCP.credits.limit} credits</span>
          </div>
          <span className="dune-conn-dot"></span>
        </div>
      </div>

      <div className="dune-queries">
        {DUNE_QUERIES.map(q => (
          <button key={q.id} className={"dune-q" + (selQuery.id === q.id ? " on" : "")} onClick={() => selectQuery(q)}>
            <div className="dune-q-name">{q.name}</div>
            <div className="dune-q-meta"><Tag tone="info">{q.category}</Tag><span className="mono dim">#{q.id}</span></div>
          </button>
        ))}
      </div>

      <div className="dune-exec">
        <div className="dune-exec-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dune-exec-title">{selQuery.name}</div>
            <div className="dim" style={{ fontSize: 12, lineHeight: 1.45 }}>{selQuery.desc}</div>
          </div>
          <div className="dune-exec-right">
            <span className="dune-status" style={{ color: statusColor[status] }}>{statusIcon[status]} {statusLabel[status]}</span>
            <button className="btn-run" onClick={run} disabled={status === "queued" || status === "executing"}>
              {status === "queued" || status === "executing" ? "Running…" : "▶ Execute"}
            </button>
          </div>
        </div>

        <div className="dune-toolbar">
          <button className={"dune-tab" + (showSql ? " on" : "")} onClick={() => setShowSql(true)}>SQL</button>
          <button className={"dune-tab" + (!showSql ? " on" : "")} onClick={() => setShowSql(false)}>Results{rows.length > 0 && ` (${rows.length})`}</button>
          <button className={"dune-log-toggle" + (showLogs ? " on" : "")} onClick={() => setShowLogs(l => !l)}><Icon path={ICONS.contract} size={12} /> Logs</button>
          {results && <span className="dune-exec-meta mono dim">{elapsed}s · {results.rows_scanned.toLocaleString()} rows scanned · {results.credits_used} credits</span>}
        </div>

        {showSql && (
          <div className="dune-sql-wrap">
            <pre className="dune-sql mono">{selQuery.sql}</pre>
          </div>
        )}

        {!showSql && (status === "queued" || status === "executing") && (
          <div className="dune-loading">
            <div className="dune-spinner"></div>
            <div>
              <div>Executing on Dune {selQuery.engine} engine…</div>
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>query #{selQuery.id} · execution {selQuery.mockResults.execution_id}</div>
            </div>
          </div>
        )}

        {!showSql && rows.length > 0 && (
          <div className="dune-results">
            <div className="q-results">
              <table>
                <thead><tr>{cols.map(c => <th key={c} className="mono">{c}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={row.risk_type === "OFAC SDN" || row.risk_type === "Tornado Cash" ? "dune-row-risk" : ""}>
                      {cols.map(c => (
                        <td key={c} className="mono" title={String(row[c] ?? "")}>
                          {c === "risk_type" && row[c] ? <Tag tone={row[c] === "OFAC SDN" ? "bad" : "warn"}>{row[c]}</Tag> : fmtCell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!showSql && status === "done" && rows.length === 0 && (
          <div className="infra-note" style={{ margin: "12px 0" }}><Icon path={ICONS.check} size={14} /><span>Query returned 0 rows — no matches found.</span></div>
        )}

        {!showSql && status === "idle" && (
          <div className="dune-empty">
            <Icon path={ICONS.pulse} size={20} />
            <div>Click <b>Execute</b> to run this query against Dune Analytics</div>
            <div className="dim" style={{ fontSize: 11 }}>Results are cached for 15 minutes after first execution</div>
          </div>
        )}

        {showLogs && (
          <div className="dune-log" ref={logEndRef}>
            {logs.map((l, i) => (
              <div key={i} className={"dune-log-line" + (l.includes("Error") ? " err" : l.includes("[MCP]") ? " mcp" : "")}>
                <span className="dune-log-ts mono">{String(i).padStart(2, "0")}</span>
                <span>{l}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="dune-log-line dim">No logs yet — execute a query to see activity</div>}
          </div>
        )}
      </div>
    </Panel>
  );
}

Object.assign(window, { DunePanel });
