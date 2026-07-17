// data_audit.jsx — audit trail, sign-offs, evidence, period comparison, cross-chain, governance, contract upgrades

const AUDIT_TRAIL = [
  { id: "AT-01", ts: "2026-06-08 09:14", action: "Finding opened", actor: "Sarah Chen", role: "Lead auditor", target: "AUR-01", type: "finding", status: "open" },
  { id: "AT-02", ts: "2026-06-08 08:47", action: "Evidence attached", actor: "Sarah Chen", role: "Lead auditor", target: "AUR-03", type: "evidence", status: "documented" },
  { id: "AT-03", ts: "2026-06-07 18:30", action: "Query executed", actor: "Marcus Webb", role: "Staff auditor", target: "Q-04", type: "query", status: "flagged" },
  { id: "AT-04", ts: "2026-06-07 16:22", action: "Sign-off requested", actor: "Sarah Chen", role: "Lead auditor", target: "Existence", type: "signoff", status: "pending" },
  { id: "AT-05", ts: "2026-06-07 14:05", action: "Sign-off approved", actor: "David Park", role: "Partner", target: "Existence", type: "signoff", status: "approved" },
  { id: "AT-06", ts: "2026-06-06 12:10", action: "Query executed", actor: "Marcus Webb", role: "Staff auditor", target: "Q-05", type: "query", status: "pass" },
  { id: "AT-07", ts: "2026-06-06 09:30", action: "Finding escalated", actor: "Sarah Chen", role: "Lead auditor", target: "AUR-02", type: "finding", status: "escalated" },
  { id: "AT-08", ts: "2026-06-05 15:40", action: "Scope confirmed", actor: "David Park", role: "Partner", target: "Engagement", type: "admin", status: "approved" },
  { id: "AT-09", ts: "2026-06-05 11:20", action: "Alert triggered", actor: "System", role: "Continuous audit", target: "AR-1", type: "alert", status: "alert" },
  { id: "AT-10", ts: "2026-06-04 09:00", action: "Engagement started", actor: "David Park", role: "Partner", target: "Engagement", type: "admin", status: "started" },
  { id: "AT-11", ts: "2026-06-03 16:10", action: "Timelock executed", actor: "System", role: "On-chain monitor", target: "GOV-06", type: "alert", status: "documented" },
  { id: "AT-12", ts: "2026-06-02 11:00", action: "Governance vote passed", actor: "System", role: "On-chain monitor", target: "GOV-01", type: "alert", status: "documented" },
];

const SIGN_OFFS = [
  { assertion: "Existence", reviewer: "David Park", role: "Partner", status: "approved", date: "2026-06-07", note: "Balances reconciled at block height. No exceptions." },
  { assertion: "Completeness", reviewer: "Sarah Chen", role: "Lead auditor", status: "in-review", date: null, note: "Mixer-adjacent findings pending resolution." },
  { assertion: "Rights & Obligations", reviewer: "Sarah Chen", role: "Lead auditor", status: "in-review", date: null, note: "Unlimited approvals under investigation." },
  { assertion: "Valuation", reviewer: "Marcus Webb", role: "Staff auditor", status: "pending", date: null, note: "Token concentration analysis complete, awaiting review." },
  { assertion: "Presentation", reviewer: "David Park", role: "Partner", status: "approved", date: "2026-06-06", note: "Disclosure mapping verified." },
];

const EVIDENCE = {
  "AUR-01": [
    { type: "tx", ref: "0x728f…e32a", block: 21847100, desc: "Treasury Safe → unverified spender (max uint256 approve)", verified: true },
    { type: "tx", ref: "0xa41c…77b2", block: 21846900, desc: "Ops EOA → unverified spender (max uint256 approve)", verified: true },
    { type: "contract", ref: "0x9f…3aE1", block: null, desc: "Unverified target contract — no source on Etherscan", verified: false },
  ],
  "AUR-02": [
    { type: "tx", ref: "0xf42d…8c1a", block: 21845200, desc: "Ops EOA called pause() on LendingPool", verified: true },
    { type: "contract", ref: "0x4c…7B2d", block: null, desc: "LendingPool — Ownable, single-key admin", verified: true },
  ],
  "AUR-03": [
    { type: "tx", ref: "0x3b91…0c4d", block: 21844800, desc: "Tornado Cash → New wallet A ($280K)", verified: true },
    { type: "tx", ref: "0x77ad…9e21", block: 21844600, desc: "Tornado Cash → New wallet B ($138K)", verified: true },
    { type: "flow", ref: "2-hop trace", block: null, desc: "OFAC SDN → Tornado → New wallets → Client wallets", verified: true },
  ],
  "AUR-04": [
    { type: "tx", ref: "0xb1e3…4f92", block: 21840100, desc: "claimRewards() — $270K claimed vs $1.47M accrued", verified: true },
    { type: "contract", ref: "RewardsDistributor", block: null, desc: "Unverified reward calculation logic", verified: false },
  ],
  "AUR-05": [
    { type: "tx", ref: "0xd821…6b3f", block: 21839400, desc: "transfer() to Binance 14 — $890K outflow", verified: true },
  ],
  "AUR-06": [
    { type: "contract", ref: "RewardsDistributor", block: null, desc: "sweep() callable by single EOA admin", verified: false },
  ],
  "AUR-07": [
    { type: "tx", ref: "0x41ce…8a2d", block: 21841200, desc: "mint() called with 2M AUR — new maxMintPerTx limit", verified: true },
  ],
};

const PERIOD_CMP = {
  q3: { treasury: 71400000, findings: 4, findingsCrit: 0, findingsHigh: 1, coverage: 0.78, riskScore: 44 },
  q4: { treasury: 84200000, findings: 7, findingsCrit: 1, findingsHigh: 2, coverage: 0.86, riskScore: 62 },
  assertionsQ3: { "Existence": 0.91, "Completeness": 0.72, "Rights & Obligations": 0.75, "Valuation": 0.61, "Presentation": 0.83 },
};

const CROSS_CHAIN = {
  chains: [
    { chain: "Ethereum", wallets: 8, contracts: 5, balanceUsd: 72400000, reconciled: true, delta: 0, block: "21,847,392" },
    { chain: "Arbitrum", wallets: 4, contracts: 3, balanceUsd: 9800000, reconciled: true, delta: 0, block: "289,421,050" },
    { chain: "Polygon", wallets: 2, contracts: 1, balanceUsd: 2000000, reconciled: false, delta: -14200, block: "68,241,800" },
  ],
  bridges: [
    { from: "Ethereum", to: "Arbitrum", amt: 4800000, bridge: "Arbitrum Bridge", status: "confirmed", txCount: 61 },
    { from: "Ethereum", to: "Polygon", amt: 890000, bridge: "Polygon PoS Bridge", status: "confirmed", txCount: 14 },
    { from: "Arbitrum", to: "Ethereum", amt: 1200000, bridge: "Arbitrum Bridge", status: "confirmed", txCount: 23 },
  ],
};

const GOVERNANCE = [
  { id: "GOV-01", type: "proposal", title: "Increase staking rewards rate to 8.5%", actor: "Treasury Safe", status: "executed", block: 21840000, date: "2026-06-02", votes: { f: 42800000, a: 1200000, q: 12360000 }, impact: "high", assertion: "Valuation" },
  { id: "GOV-02", type: "parameter", title: "Oracle update: Chainlink → Pyth for AUR/USD", actor: "Ops EOA", status: "executed", block: 21842000, date: "2026-06-04", impact: "high", assertion: "Valuation" },
  { id: "GOV-03", type: "proposal", title: "Add WBTC collateral to lending pool", actor: "Whale 0x3c", status: "active", block: 21846000, date: "2026-06-07", votes: { f: 31200000, a: 8400000, q: 12360000 }, impact: "medium", assertion: "Completeness" },
  { id: "GOV-04", type: "parameter", title: "LTV ratio adjusted: 75% → 70% on ETH collateral", actor: "Treasury Safe", status: "executed", block: 21838000, date: "2026-05-30", impact: "medium", assertion: "Valuation" },
  { id: "GOV-05", type: "proposal", title: "Allocate 500K AUR to ecosystem grants", actor: "Treasury Safe", status: "executed", block: 21835000, date: "2026-05-28", votes: { f: 51000000, a: 3800000, q: 12360000 }, impact: "low", assertion: "Presentation" },
  { id: "GOV-06", type: "timelock", title: "48h timelock executed: setRewardRate()", actor: "StakingVault", status: "executed", block: 21841500, date: "2026-06-03", impact: "medium", assertion: "Valuation" },
];

const CONTRACT_UPGRADES = [
  { id: "UPG-01", contract: "LendingPool", type: "proxy", date: "2026-06-04", block: 21842100, oldImpl: "0x1a…4f2d (v2.1)", newImpl: "0x8b…c3e1 (v2.2)", verified: true, diff: "+setOracle(), +emergencyPause()", risk: "high", note: "New oracle integration + emergency stop. Source verified on Etherscan." },
  { id: "UPG-02", contract: "AURToken", type: "param", date: "2026-06-02", block: 21840100, oldImpl: null, newImpl: null, verified: true, diff: "maxMintPerTx: 1M → 2M AUR", risk: "medium", note: "Mint cap doubled. Tied to GOV-01 vote." },
  { id: "UPG-03", contract: "StakingVault", type: "param", date: "2026-05-30", block: 21838200, oldImpl: null, newImpl: null, verified: true, diff: "rewardRate: 7.2% → 8.5% APY", risk: "low", note: "Rate increase per GOV-01 proposal." },
  { id: "UPG-04", contract: "RewardsDistributor", type: "proxy", date: "2026-05-25", block: 21832000, oldImpl: "0x3f…7a1b (v1.0)", newImpl: "0x88…1c0f (v1.1)", verified: false, diff: "Unknown — bytecode not published", risk: "critical", note: "Upgrade to unverified implementation. Links to AUR-01 finding." },
];

Object.assign(window.ADATA, { AUDIT_TRAIL, SIGN_OFFS, EVIDENCE, PERIOD_CMP, CROSS_CHAIN, GOVERNANCE, CONTRACT_UPGRADES });
