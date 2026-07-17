// data.jsx — mock data layer for the Blockchain Audit System prototype.
// All data is simulated but uses real on-chain formats (0x addresses, 32-byte hashes).

const HEX = "0123456789abcdef";
function rand(seed) {
  // deterministic-ish pseudo random from a mutable counter
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function addr(seed) {
  let s = "0x";
  for (let i = 0; i < 40; i++) s += HEX[Math.floor(rand(seed * 7.3 + i * 1.7) * 16)];
  return s;
}
function txhash(seed) {
  let s = "0x";
  for (let i = 0; i < 64; i++) s += HEX[Math.floor(rand(seed * 3.1 + i * 2.9) * 16)];
  return s;
}
function shortAddr(a) { return a.slice(0, 6) + "…" + a.slice(-4); }

// ---- Clients (audit engagements) ----
const CLIENTS = [
  {
    id: "aurora",
    name: "Aurora Protocol",
    ticker: "AUR",
    type: "DeFi lending protocol",
    fy: "FY2025 · Q4",
    treasury: "$84.2M",
    wallets: 14,
    contracts: 9,
    coverage: 0.86,
    openFindings: 7,
    riskScore: 62,
  },
  {
    id: "meridian",
    name: "Meridian DAO",
    ticker: "MRD",
    type: "Governance / treasury",
    fy: "FY2025 · Q4",
    treasury: "$211.7M",
    wallets: 23,
    contracts: 16,
    coverage: 0.71,
    openFindings: 12,
    riskScore: 74,
  },
  {
    id: "helix",
    name: "Helix Labs",
    ticker: "HLX",
    type: "L2 infra / staking",
    fy: "FY2025 · Q4",
    treasury: "$39.8M",
    wallets: 8,
    contracts: 5,
    coverage: 0.93,
    openFindings: 3,
    riskScore: 38,
  },
];

// ---- Risk model ----
// Composite = impact (1-5) × likelihood (1-5), bucketed into severity.
const SEVERITY = {
  critical: { label: "Critical", color: "#dc3545", min: 20 },
  high: { label: "High", color: "#e8652a", min: 12 },
  medium: { label: "Medium", color: "#d9940e", min: 6 },
  low: { label: "Low", color: "#1a9d5e", min: 3 },
  info: { label: "Informational", color: "#3b82f6", min: 0 },
};
function severityOf(impact, likelihood) {
  const s = impact * likelihood;
  if (s >= SEVERITY.critical.min) return "critical";
  if (s >= SEVERITY.high.min) return "high";
  if (s >= SEVERITY.medium.min) return "medium";
  if (s >= SEVERITY.low.min) return "low";
  return "info";
}

// ---- Findings (risk register) ----
const FINDINGS = [
  {
    id: "AUR-01", client: "aurora", title: "Unlimited token approval to unverified spender",
    category: "Approval risk", impact: 5, likelihood: 4,
    assertion: "Rights & Obligations",
    desc: "Treasury wallet 0x9f…3aE1 holds an open, unlimited USDC allowance granted to an unverified contract. If compromised, the full balance is drainable.",
    addr: addr(11), txn: txhash(11), detected: "2026-06-08 09:14 UTC", status: "open",
  },
  {
    id: "AUR-02", client: "aurora", title: "Owner can pause withdrawals (centralization)",
    category: "Smart-contract behavior", impact: 4, likelihood: 3,
    assertion: "Presentation & Disclosure",
    desc: "LendingPool proxy admin is a 1-of-1 EOA, not a multisig. A single key can pause user withdrawals — a disclosable concentration of control.",
    addr: addr(12), txn: txhash(12), detected: "2026-06-07 22:41 UTC", status: "open",
  },
  {
    id: "AUR-03", client: "aurora", title: "Counterparty flow to sanctioned-adjacent mixer",
    category: "Counterparty / AML", impact: 5, likelihood: 2,
    assertion: "Completeness",
    desc: "3 inbound transfers (~$418K) trace 2 hops from a tagged mixer contract. Source-of-funds requires documentation before recognition.",
    addr: addr(13), txn: txhash(13), detected: "2026-06-06 13:02 UTC", status: "open",
  },
  {
    id: "AUR-04", client: "aurora", title: "Staking rewards recognized before control transfer",
    category: "Revenue recognition", impact: 3, likelihood: 4,
    assertion: "Cut-off",
    desc: "Rewards accrued but not yet claimable were recognized as revenue. Under ASC 606 control transfers at claim/withdrawal — timing difference of $1.2M.",
    addr: addr(14), txn: txhash(14), detected: "2026-06-05 16:30 UTC", status: "open",
  },
  {
    id: "AUR-05", client: "aurora", title: "Vesting cliff obligation not classified as liability",
    category: "Liability classification", impact: 3, likelihood: 3,
    assertion: "Completeness",
    desc: "11.4M AUR vest to team over 24 months. The unvested obligation is not reflected; portion may require liability or contra-equity treatment.",
    addr: addr(15), txn: txhash(15), detected: "2026-06-04 11:55 UTC", status: "open",
  },
  {
    id: "AUR-06", client: "aurora", title: "Stale price oracle on collateral asset",
    category: "Asset measurement", impact: 4, likelihood: 2,
    assertion: "Valuation",
    desc: "Collateral mark uses an oracle last updated 9h ago during volatility. Fair-value measurement may be misstated; impairment test recommended.",
    addr: addr(16), txn: txhash(16), detected: "2026-06-03 08:10 UTC", status: "monitoring",
  },
  {
    id: "AUR-07", client: "aurora", title: "Gas fees expensed to wrong cost center",
    category: "Gas / fee reconciliation", impact: 2, likelihood: 3,
    assertion: "Classification",
    desc: "Network fees for protocol operations booked to G&A rather than COGS. Immaterial individually; reclassification recommended for presentation.",
    addr: addr(17), txn: txhash(17), detected: "2026-06-02 19:22 UTC", status: "open",
  },
];

// ---- Live transaction generator ----
const TX_KINDS = [
  { method: "transfer", token: "USDC", anomaly: null },
  { method: "transfer", token: "AUR", anomaly: null },
  { method: "swapExactTokensForTokens", token: "WETH", anomaly: null },
  { method: "approve", token: "USDC", anomaly: null },
  { method: "stake", token: "AUR", anomaly: null },
  { method: "claimRewards", token: "AUR", anomaly: null },
];
const ANOMALY_TYPES = [
  { type: "Value outlier", reason: "Transfer 14.2× the 30-day counterparty mean", impact: 4, likelihood: 4 },
  { type: "Unlimited approval", reason: "approve() with max uint256 to new spender", impact: 5, likelihood: 3 },
  { type: "Mixer proximity", reason: "Counterparty 2 hops from tagged mixer", impact: 5, likelihood: 2 },
  { type: "Circular flow", reason: "Funds returned to origin within 3 blocks (wash pattern)", impact: 3, likelihood: 4 },
  { type: "New counterparty burst", reason: "11 first-seen addresses in 60s", impact: 2, likelihood: 4 },
  { type: "Off-hours spike", reason: "High-value tx at 03:40 UTC, outside ops window", impact: 2, likelihood: 3 },
];

let _txSeed = 1000;
function makeTx(blockBase) {
  _txSeed += 1;
  const seed = _txSeed;
  const r = rand(seed * 1.3);
  const isAnomaly = rand(seed * 2.7) < 0.22;
  const kind = TX_KINDS[Math.floor(rand(seed * 4.1) * TX_KINDS.length)];
  const anomaly = isAnomaly ? ANOMALY_TYPES[Math.floor(rand(seed * 5.5) * ANOMALY_TYPES.length)] : null;
  const valueEth = (rand(seed * 6.6) * (isAnomaly ? 800 : 60)).toFixed(3);
  const usd = Math.round(parseFloat(valueEth) * 3120);
  return {
    id: seed,
    hash: txhash(seed),
    block: blockBase,
    from: addr(seed * 1.1),
    to: addr(seed * 1.9),
    method: kind.method,
    token: kind.token,
    valueEth,
    usd,
    gas: (rand(seed * 7.7) * 0.012 + 0.0008).toFixed(5),
    anomaly,
    severity: anomaly ? severityOf(anomaly.impact, anomaly.likelihood) : null,
    ts: Date.now(),
  };
}

// ---- Tokens (existence & ownership) ----
const TOKENS = [
  { symbol: "AUR", name: "Aurora Token", std: "ERC-20", contract: addr(201), verified: true,
    held: "48,200,000", value: "$36.6M", custody: "Gnosis Safe 4/7", reconciled: true, note: "Native governance + fee token" },
  { symbol: "USDC", name: "USD Coin", std: "ERC-20", contract: addr(202), verified: true,
    held: "31,940,118", value: "$31.94M", custody: "Gnosis Safe 4/7", reconciled: true, note: "Treasury stablecoin reserve" },
  { symbol: "WETH", name: "Wrapped Ether", std: "ERC-20", contract: addr(203), verified: true,
    held: "4,712.4", value: "$14.7M", custody: "Gnosis Safe 4/7", reconciled: true, note: "Operating liquidity" },
  { symbol: "aUSDC", name: "Aurora Receipt USDC", std: "ERC-20", contract: addr(204), verified: true,
    held: "12,004,991", value: "$12.0M", custody: "LendingPool", reconciled: false, note: "Interest-bearing receipt — measurement under review" },
  { symbol: "AUR-LP", name: "AUR/WETH LP", std: "ERC-20", contract: addr(205), verified: false,
    held: "882,140", value: "$2.1M", custody: "EOA 0x4c…", reconciled: false, note: "Unverified LP contract — existence assertion pending" },
  { symbol: "GENESIS", name: "Aurora Genesis Pass", std: "ERC-721", contract: addr(206), verified: true,
    held: "120 NFTs", value: "$0.9M", custody: "Gnosis Safe 4/7", reconciled: true, note: "Founder collection — ownership confirmed on-chain" },
];

// ---- Contracts (behavior & centralization) ----
const CONTRACTS = [
  { name: "LendingPool", address: addr(301), verified: true, proxy: "Transparent (upgradeable)",
    admin: "EOA 0x9f…3aE1", privileges: ["pause", "upgrade", "setOracle"], centralization: "High",
    severity: "high", note: "Single-key proxy admin can pause withdrawals & swap oracle." },
  { name: "AURToken", address: addr(302), verified: true, proxy: "Non-upgradeable",
    admin: "Gnosis Safe 4/7", privileges: ["mint", "burn"], centralization: "Medium",
    severity: "medium", note: "Mint capped by hard supply; controlled by multisig." },
  { name: "StakingVault", address: addr(303), verified: true, proxy: "UUPS (upgradeable)",
    admin: "Gnosis Safe 4/7", privileges: ["upgrade", "setRewardRate"], centralization: "Medium",
    severity: "medium", note: "Reward rate is owner-settable; multisig-gated." },
  { name: "Treasury", address: addr(304), verified: true, proxy: "Non-upgradeable",
    admin: "Gnosis Safe 4/7", privileges: ["withdraw"], centralization: "Low",
    severity: "low", note: "4-of-7 multisig, timelock 48h on withdrawals." },
  { name: "RewardsDistributor", address: addr(305), verified: false, proxy: "Unknown",
    admin: "EOA 0x4c…7B2d", privileges: ["setMerkleRoot", "sweep"], centralization: "High",
    severity: "high", note: "Unverified bytecode; sweep() can move unclaimed rewards." },
];

// ---- Tokenomics → financial reporting bridge ----
const TOKENOMICS = [
  { event: "Token sale (private round)", onchain: "8.0M AUR @ $0.42 → treasury inflow",
    treatment: "Deferred revenue / equity", assertion: "Completeness", standard: "ASC 606 / IAS 32",
    amount: "$3.36M", flag: "review", note: "Utility vs. equity character determines liability vs. equity." },
  { event: "Staking rewards emitted", onchain: "1.94M AUR distributed to stakers",
    treatment: "Expense (token-based)", assertion: "Cut-off", standard: "ASC 718-adj",
    amount: "$1.47M", flag: "review", note: "Measure at grant-date fair value; timing vs. claim." },
  { event: "Protocol fees collected", onchain: "Fees swept to treasury (USDC)",
    treatment: "Revenue", assertion: "Occurrence", standard: "ASC 606",
    amount: "$2.81M", flag: "ok", note: "Control transfers on settlement — recognize at sweep." },
  { event: "Team vesting (unvested)", onchain: "11.4M AUR locked, 24-mo linear",
    treatment: "Liability / contra-equity", assertion: "Completeness", standard: "ASC 480",
    amount: "$8.66M", flag: "alert", note: "Unvested obligation not currently on balance sheet." },
  { event: "Airdrop distribution", onchain: "2.2M AUR claimed by 14,002 wallets",
    treatment: "Marketing expense", assertion: "Occurrence", standard: "ASC 720",
    amount: "$1.67M", flag: "ok", note: "Recognize at fair value on claim." },
  { event: "Treasury token holding (AUR)", onchain: "48.2M AUR self-held",
    treatment: "Not an asset (own equity)", assertion: "Existence", standard: "ASC 505",
    amount: "—", flag: "alert", note: "Self-issued tokens are not assets; exclude from treasury value." },
  { event: "Governance token buyback", onchain: "0.9M AUR repurchased & burned",
    treatment: "Treasury stock / retirement", assertion: "Rights & Obligations", standard: "ASC 505-30",
    amount: "$0.68M", flag: "ok", note: "Burn = retirement; reduce outstanding supply." },
];

// ---- Validator / infrastructure ----
const VALIDATORS = {
  active: 412, effectiveBalance: "13,184 ETH", attestationRate: 0.9981,
  proposed: 38, missed: 2, slashing: 0, mevReward: "21.4 ETH",
  withdrawalCreds: "0x01 (set)", note: "Withdrawal credentials point to Gnosis Safe — custody confirmed.",
};

// assertion coverage for overview
const ASSERTIONS = [
  { name: "Existence", pct: 0.94 },
  { name: "Completeness", pct: 0.78 },
  { name: "Rights & Obligations", pct: 0.82 },
  { name: "Valuation", pct: 0.69 },
  { name: "Presentation", pct: 0.88 },
];

Object.assign(window, {
  ADATA: {
    CLIENTS, FINDINGS, TOKENS, CONTRACTS, TOKENOMICS, VALIDATORS, ASSERTIONS,
    SEVERITY, ANOMALY_TYPES,
    severityOf, makeTx, shortAddr, addr, txhash,
  },
});
