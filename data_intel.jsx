// data_intel.jsx — entity labeling, wallet profiles, fund flows, audit queries, alerts, holders.
// Loads AFTER data.jsx; extends window.ADATA.

// ---- Entity type metadata (Nansen-style labels) ----
const ENTITY_TYPES = {
  client:     { label: "Client wallet", color: "#3b82f6", short: "CLIENT" },
  cex:        { label: "Exchange",      color: "#0e7c6b", short: "CEX" },
  bridge:     { label: "Bridge",        color: "#8b7cf0", short: "BRIDGE" },
  defi:       { label: "DeFi protocol", color: "#1a9d5e", short: "DEFI" },
  mm:         { label: "Market maker",  color: "#2dd4bf", short: "MM" },
  smart:      { label: "Smart money",   color: "#c49000", short: "SMART$" },
  mixer:      { label: "Mixer",         color: "#dc3545", short: "MIXER" },
  sanctioned: { label: "Sanctioned",    color: "#dc3545", short: "OFAC" },
  contract:   { label: "Contract",      color: "#8896a6", short: "CONTRACT" },
  unknown:    { label: "Unlabeled",     color: "#5b6776", short: "UNKNOWN" },
};

// ---- Labeled entities (the "label database") ----
const E = (id, name, type, seed, risk, balanceUsd, ageDays, txCount, tags, note) =>
  ({ id, name, type, address: ADATA.addr(seed), risk, balanceUsd, ageDays, txCount, tags, note });

const ENTITIES = [
  E("treasury", "Aurora Treasury Safe", "client", 501, null, 84200000, 612, 4821, ["multisig 4/7", "in-scope"], "Primary client treasury — Gnosis Safe."),
  E("ops", "Aurora Ops EOA", "client", 502, "med", 1840000, 410, 9210, ["hot wallet", "SPOF"], "Single-key operations wallet — custody risk."),
  E("staking", "Aurora Staking Vault", "client", 503, null, 21400000, 388, 15402, ["contract", "in-scope"], "Staking rewards vault contract."),
  E("binance14", "Binance 14", "cex", 504, null, 0, 1820, 9900000, ["hot wallet"], "Known Binance hot wallet."),
  E("coinbase", "Coinbase Prime", "cex", 505, null, 0, 1640, 4100000, ["custodian"], "Institutional custody venue."),
  E("kraken", "Kraken Hot", "cex", 506, null, 0, 1500, 2800000, ["hot wallet"], "Kraken deposit address cluster."),
  E("arb", "Arbitrum Bridge", "bridge", 507, "low", 0, 1200, 880000, ["canonical"], "Canonical L2 bridge."),
  E("wormhole", "Wormhole Portal", "bridge", 508, "med", 0, 900, 410000, ["cross-chain"], "Cross-chain bridge — historical exploit history."),
  E("uniswap", "Uniswap V3 Router", "defi", 509, null, 0, 1400, 22000000, ["AMM"], "DEX router."),
  E("aave", "Aave V3 Pool", "defi", 510, null, 0, 1100, 5400000, ["lending"], "Lending pool."),
  E("curve", "Curve 3pool", "defi", 511, null, 0, 1350, 7200000, ["stable AMM"], "Stablecoin pool."),
  E("wintermute", "Wintermute", "mm", 512, null, 0, 980, 1900000, ["market maker"], "Liquidity provider / MM."),
  E("jump", "Jump Trading", "mm", 513, null, 0, 1050, 1600000, ["market maker"], "Institutional MM."),
  E("smartA", "Smart Money: Fund Alpha", "smart", 514, null, 41200000, 740, 12400, ["top PnL", "early LP"], "Profitable fund wallet — Smart Money cohort."),
  E("smartB", "Smart Money: Whale 0x3c", "smart", 515, null, 88600000, 690, 8200, ["whale", "governance"], "Large AUR holder & governance voter."),
  E("tornado", "Tornado Cash: Router", "mixer", 516, "critical", 0, 1300, 740000, ["mixer", "tagged"], "Sanctioned mixer contract — high AML risk."),
  E("ofac", "OFAC SDN 0x7Fb…", "sanctioned", 517, "critical", 0, 410, 88, ["SDN list", "blocked"], "Address on OFAC sanctions list."),
  E("fresh1", "New wallet", "unknown", 518, "low", 12000, 2, 4, ["first-seen"], "Recently created, sparse history."),
  E("fresh2", "New wallet", "unknown", 519, "low", 3400, 1, 2, ["first-seen"], "Recently created, sparse history."),
  E("rewards", "RewardsDistributor", "contract", 520, "high", 2100000, 300, 18900, ["unverified"], "Unverified bytecode — sweep() risk."),
];
const ENTITY_BY_ID = Object.fromEntries(ENTITIES.map(e => [e.id, e]));

// ---- Live tx generator with entity attribution (overrides ADATA.makeTx) ----
const CLIENT_IDS = ["treasury", "ops", "staking"];
const CP_POOL = ["binance14", "coinbase", "kraken", "arb", "wormhole", "uniswap", "aave", "curve",
  "wintermute", "jump", "smartA", "smartB", "tornado", "ofac", "fresh1", "fresh2", "rewards"];
let _ts2 = 4000;
function makeTxIntel(blockBase) {
  _ts2 += 1; const seed = _ts2; const r = (k) => { let x = Math.sin(seed * k) * 10000; return x - Math.floor(x); };
  const clientE = ENTITY_BY_ID[CLIENT_IDS[Math.floor(r(1.1) * CLIENT_IDS.length)]];
  const cpE = ENTITY_BY_ID[CP_POOL[Math.floor(r(2.3) * CP_POOL.length)]];
  const outbound = r(3.1) < 0.5;
  const from = outbound ? clientE : cpE;
  const to = outbound ? cpE : clientE;

  let anomaly = null;
  if (cpE.type === "mixer") anomaly = { type: "Mixer interaction", reason: "Direct transfer to/from tagged mixer (Tornado Cash)", impact: 5, likelihood: 2 };
  else if (cpE.type === "sanctioned") anomaly = { type: "Sanctioned counterparty", reason: "Counterparty on OFAC SDN list — blocked entity", impact: 5, likelihood: 3 };
  else if (cpE.type === "unknown" && r(4.2) < 0.6) anomaly = { type: "New counterparty", reason: "First-seen counterparty with sparse history", impact: 2, likelihood: 4 };
  else if (r(5.5) < 0.12) {
    const pool = [
      { type: "Value outlier", reason: "Transfer 14.2× the 30-day counterparty mean", impact: 4, likelihood: 4 },
      { type: "Unlimited approval", reason: "approve() with max uint256 to new spender", impact: 5, likelihood: 3 },
      { type: "Circular flow", reason: "Funds returned to origin within 3 blocks (wash pattern)", impact: 3, likelihood: 4 },
      { type: "Off-hours spike", reason: "High-value tx at 03:40 UTC, outside ops window", impact: 2, likelihood: 3 },
    ];
    anomaly = pool[Math.floor(r(6.6) * pool.length)];
  }
  const methods = ["transfer", "swapExactTokensForTokens", "approve", "stake", "claimRewards", "deposit"];
  const valueEth = (r(7.7) * (anomaly ? 700 : 55) + 0.4).toFixed(3);
  return {
    id: seed, hash: ADATA.txhash(seed), block: blockBase,
    from: from.address, to: to.address, fromEntity: from, toEntity: to,
    method: methods[Math.floor(r(8.8) * methods.length)], token: ["USDC", "AUR", "WETH"][Math.floor(r(9.1) * 3)],
    valueEth, usd: Math.round(parseFloat(valueEth) * 3120),
    gas: (r(10.2) * 0.012 + 0.0008).toFixed(5),
    anomaly, severity: anomaly ? ADATA.severityOf(anomaly.impact, anomaly.likelihood) : null, ts: Date.now(),
  };
}

// ---- Counterparty exposure rollup ----
const EXPOSURE = [
  { type: "cex", flowsUsd: 18400000, count: 142, risk: "low" },
  { type: "defi", flowsUsd: 9200000, count: 318, risk: "low" },
  { type: "smart", flowsUsd: 6100000, count: 44, risk: "low" },
  { type: "bridge", flowsUsd: 4800000, count: 61, risk: "med" },
  { type: "mm", flowsUsd: 3300000, count: 39, risk: "low" },
  { type: "mixer", flowsUsd: 418000, count: 3, risk: "critical" },
  { type: "sanctioned", flowsUsd: 92000, count: 1, risk: "critical" },
  { type: "unknown", flowsUsd: 1240000, count: 88, risk: "med" },
];

// ---- Fund-flow scenarios (Sankey) ----
const FUND_FLOWS = {
  "mixer": {
    label: "AUR-03 · Mixer-adjacent inflow trace",
    desc: "Source-of-funds tracing for $418K of inbound transfers flagged 2 hops from a tagged mixer.",
    nodes: [
      { id: "ofac", label: "OFAC SDN 0x7Fb", type: "sanctioned", col: 0 },
      { id: "tornado", label: "Tornado Cash", type: "mixer", col: 1 },
      { id: "fresh1", label: "New wallet A", type: "unknown", col: 2 },
      { id: "fresh2", label: "New wallet B", type: "unknown", col: 2 },
      { id: "ops", label: "Aurora Ops EOA", type: "client", col: 3 },
      { id: "treasury", label: "Treasury Safe", type: "client", col: 3 },
    ],
    links: [
      { s: "ofac", t: "tornado", amt: 510000, risk: "critical" },
      { s: "tornado", t: "fresh1", amt: 300000, risk: "high" },
      { s: "tornado", t: "fresh2", amt: 210000, risk: "high" },
      { s: "fresh1", t: "ops", amt: 280000, risk: "high" },
      { s: "fresh2", t: "treasury", amt: 138000, risk: "med" },
    ],
  },
  "treasury": {
    label: "Treasury outflow · use-of-funds",
    desc: "Where treasury funds went this period — destinations and counterparties.",
    nodes: [
      { id: "treasury", label: "Treasury Safe", type: "client", col: 0 },
      { id: "uniswap", label: "Uniswap V3", type: "defi", col: 1 },
      { id: "aave", label: "Aave V3", type: "defi", col: 1 },
      { id: "binance14", label: "Binance 14", type: "cex", col: 2 },
      { id: "staking", label: "Staking Vault", type: "client", col: 2 },
      { id: "wintermute", label: "Wintermute", type: "mm", col: 2 },
    ],
    links: [
      { s: "treasury", t: "uniswap", amt: 4200000, risk: "low" },
      { s: "treasury", t: "aave", amt: 3100000, risk: "low" },
      { s: "uniswap", t: "binance14", amt: 1800000, risk: "low" },
      { s: "uniswap", t: "wintermute", amt: 2100000, risk: "low" },
      { s: "aave", t: "staking", amt: 3100000, risk: "low" },
    ],
  },
};

// ---- Audit query library (Dune-style) ----
const AUDIT_QUERIES = [
  { id: "Q-01", name: "Unlimited approvals to unverified spenders", assertion: "Rights & Obligations", lastRun: "2026-06-08 09:14", status: "flag", rows: 3,
    sql: "SELECT tx_hash, owner, spender, amount\nFROM erc20_approvals\nWHERE amount = MAX_UINT256\n  AND owner IN (SELECT addr FROM client_wallets)\n  AND spender NOT IN (SELECT addr FROM verified_contracts)\nORDER BY block_time DESC;",
    cols: ["tx_hash", "owner", "spender", "amount"],
    results: [["0x728f…e32a", "Treasury Safe", "0x9f…3aE1 (unverified)", "∞"], ["0xa41c…77b2", "Ops EOA", "0x4c…7B2d (unverified)", "∞"], ["0xd2fa…a677", "Staking Vault", "0x88…1c0f (unverified)", "∞"]] },
  { id: "Q-02", name: "Inbound transfers ≤2 hops from tagged mixer", assertion: "Completeness", lastRun: "2026-06-08 06:02", status: "flag", rows: 3,
    sql: "WITH traced AS (\n  SELECT * FROM trace_funds(client_wallets, hops => 2)\n)\nSELECT tx_hash, source_label, hops, amount_usd\nFROM traced\nWHERE source_type IN ('mixer','sanctioned');",
    cols: ["tx_hash", "source", "hops", "amount_usd"],
    results: [["0x3b91…0c4d", "Tornado Cash", "2", "$280,000"], ["0x77ad…9e21", "Tornado Cash", "2", "$138,000"], ["0x91f0…2ab8", "New wallet A", "1", "$418,000"]] },
  { id: "Q-03", name: "Balance reconciliation at FY close block", assertion: "Existence", lastRun: "2026-06-07 23:59", status: "pass", rows: 6,
    sql: "SELECT token, ledger_balance, onchain_balance,\n       ledger_balance - onchain_balance AS delta\nFROM ledger_positions l\nJOIN onchain_balances o USING (token)\nWHERE o.block = 21847392;",
    cols: ["token", "ledger", "on-chain", "delta"],
    results: [["AUR", "48,200,000", "48,200,000", "0"], ["USDC", "31,940,118", "31,940,118", "0"], ["WETH", "4,712.4", "4,712.4", "0"], ["aUSDC", "12,004,991", "12,004,991", "0"]] },
  { id: "Q-04", name: "Staking rewards recognized before claim", assertion: "Cut-off", lastRun: "2026-06-07 18:30", status: "flag", rows: 1,
    sql: "SELECT period, accrued_usd, claimed_usd,\n       accrued_usd - claimed_usd AS timing_diff\nFROM rewards_recognition\nWHERE accrued_usd > claimed_usd;",
    cols: ["period", "accrued", "claimed", "timing_diff"],
    results: [["FY25 Q4", "$1,470,000", "$270,000", "$1,200,000"]] },
  { id: "Q-05", name: "Holder concentration & locked supply (AUR)", assertion: "Valuation", lastRun: "2026-06-06 12:10", status: "pass", rows: 10,
    sql: "SELECT holder_label, balance, pct_supply, is_locked\nFROM token_holders\nWHERE token = 'AUR'\nORDER BY balance DESC\nLIMIT 10;",
    cols: ["holder", "balance", "% supply", "locked"],
    results: [["Treasury Safe", "48.2M", "39.0%", "no"], ["Team vesting", "11.4M", "9.2%", "yes"], ["Whale 0x3c", "8.6M", "7.0%", "no"], ["Staking Vault", "6.1M", "4.9%", "no"]] },
  { id: "Q-06", name: "Privileged function calls (admin actions)", assertion: "Presentation & Disclosure", lastRun: "2026-06-05 08:44", status: "pass", rows: 4,
    sql: "SELECT tx_hash, contract, method, caller, block_time\nFROM decoded_calls\nWHERE method IN ('pause','upgrade','mint','setOracle','sweep')\n  AND contract IN (SELECT addr FROM client_contracts);",
    cols: ["contract", "method", "caller", "time"],
    results: [["LendingPool", "setOracle", "Ops EOA", "06-04 11:20"], ["AURToken", "mint", "Treasury Safe", "06-02 09:00"], ["StakingVault", "setRewardRate", "Treasury Safe", "05-30 14:10"]] },
];

// ---- Configurable alert rules ----
const ALERT_RULES = [
  { id: "AR-1", name: "Transfer to/from sanctioned or mixer", condition: "counterparty.type ∈ {sanctioned, mixer}", severity: "critical", enabled: true, threshold: 0, channel: "Pager + Email", triggered: 4 },
  { id: "AR-2", name: "Large treasury movement", condition: "value_usd > threshold", severity: "high", enabled: true, threshold: 500000, channel: "Email", triggered: 11 },
  { id: "AR-3", name: "Unlimited token approval", condition: "approve.amount = MAX_UINT256", severity: "high", enabled: true, threshold: 0, channel: "Email + Slack", triggered: 6 },
  { id: "AR-4", name: "New / first-seen counterparty", condition: "counterparty.age_days < threshold", severity: "medium", enabled: true, threshold: 7, channel: "Slack", triggered: 23 },
  { id: "AR-5", name: "Privileged admin call (pause/upgrade/mint)", condition: "method ∈ privileged_set", severity: "high", enabled: true, threshold: 0, channel: "Email", triggered: 3 },
  { id: "AR-6", name: "Off-hours high-value activity", condition: "value_usd > threshold AND hour ∉ ops_window", severity: "medium", enabled: false, threshold: 250000, channel: "Slack", triggered: 0 },
  { id: "AR-7", name: "Oracle staleness on collateral", condition: "oracle.age_minutes > threshold", severity: "medium", enabled: true, threshold: 60, channel: "Email", triggered: 2 },
];
const ALERT_FEED = [
  { rule: "AR-1", sev: "critical", text: "Inbound $138K traced 2 hops from Tornado Cash → Treasury Safe", time: "09:14:22", entity: "tornado" },
  { rule: "AR-3", sev: "high", text: "Unlimited USDC approval by Treasury Safe → 0x9f…3aE1 (unverified)", time: "09:02:51", entity: "rewards" },
  { rule: "AR-2", sev: "high", text: "Treasury outflow $890K → Binance 14", time: "08:47:10", entity: "binance14" },
  { rule: "AR-4", sev: "medium", text: "11 first-seen counterparties in 60s window", time: "08:31:05", entity: "fresh1" },
  { rule: "AR-5", sev: "high", text: "setOracle() called on LendingPool by Ops EOA", time: "07:55:44", entity: "ops" },
  { rule: "AR-1", sev: "critical", text: "Counterparty 0x7Fb… matched OFAC SDN list", time: "07:12:09", entity: "ofac" },
];

// ---- Holder concentration (AUR) ----
const HOLDERS = {
  token: "AUR", supply: "123.6M", circulating: "76.8M",
  metrics: { top10: 0.71, whales: 0.16, locked: 0.21, exchanges: 0.08 },
  rows: [
    { label: "Aurora Treasury Safe", type: "client", pct: 0.39, amount: "48.2M", locked: false, note: "Self-held — exclude from float" },
    { label: "Team vesting (locked)", type: "contract", pct: 0.092, amount: "11.4M", locked: true, note: "24-mo cliff — liability/contra-equity" },
    { label: "Smart Money: Whale 0x3c", type: "smart", pct: 0.07, amount: "8.6M", locked: false, note: "Governance voter" },
    { label: "Aurora Staking Vault", type: "client", pct: 0.049, amount: "6.1M", locked: true, note: "Staked, time-locked" },
    { label: "Smart Money: Fund Alpha", type: "smart", pct: 0.038, amount: "4.7M", locked: false, note: "Early LP" },
    { label: "Binance 14", type: "cex", pct: 0.031, amount: "3.8M", locked: false, note: "Exchange float" },
    { label: "Other (12,400 wallets)", type: "unknown", pct: 0.33, amount: "40.8M", locked: false, note: "Long tail" },
  ],
};

function resolveEntity(address) { return ENTITIES.find(e => e.address === address) || null; }

// Link a couple of static findings to labeled entities so labels resolve in the register
(function linkFindings() {
  const a1 = ADATA.FINDINGS.find(f => f.id === "AUR-01"); if (a1) a1.addr = ENTITY_BY_ID.rewards.address;
  const a3 = ADATA.FINDINGS.find(f => f.id === "AUR-03"); if (a3) a3.addr = ENTITY_BY_ID.tornado.address;
  const a2 = ADATA.FINDINGS.find(f => f.id === "AUR-02"); if (a2) a2.addr = ENTITY_BY_ID.ops.address;
})();

Object.assign(window.ADATA, {
  ENTITY_TYPES, ENTITIES, ENTITY_BY_ID, EXPOSURE, FUND_FLOWS, AUDIT_QUERIES,
  ALERT_RULES, ALERT_FEED, HOLDERS, resolveEntity,
  makeTx: makeTxIntel,
});
