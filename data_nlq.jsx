// data_nlq.jsx — mock data for natural language query feature

const NLQ_SUGGESTED = [
  { text: "Show all transactions over $100K from mixer-adjacent addresses", cat: "AML" },
  { text: "What's our total exposure to sanctioned entities this quarter?", cat: "Risk" },
  { text: "List all unlimited token approvals on Aurora wallets", cat: "Controls" },
  { text: "Which contracts have single-key admin privileges?", cat: "Controls" },
  { text: "Summarize unreconciled balances across all chains", cat: "Reconciliation" },
  { text: "Show staking rewards recognized before control transfer", cat: "Revenue" },
  { text: "What governance proposals changed valuation parameters?", cat: "Governance" },
  { text: "Find all wallets with outflows to unlabeled addresses in the last 7 days", cat: "AML" },
];

const NLQ_HISTORY = [
  {
    id: "nlq-1",
    query: "Show all transactions over $100K from mixer-adjacent addresses",
    ts: "2026-06-08 14:22",
    intent: "Filter transactions by value threshold ($100K+) where counterparty is within 2 hops of a tagged mixer contract.",
    sql: `SELECT t.hash, t.block, t.from_addr, t.to_addr,\n       t.value_usd, t.method, e.entity_type, e.hop_distance\nFROM   transactions t\nJOIN   entity_labels e ON t.from_addr = e.address\nWHERE  t.value_usd > 100000\n  AND  e.entity_type IN ('mixer', 'mixer_adjacent')\n  AND  e.hop_distance <= 2\n  AND  t.block BETWEEN 21840000 AND 21847392\nORDER BY t.value_usd DESC;`,
    cols: ["Tx hash", "Block", "From", "To", "Value", "Method", "Entity type", "Hops"],
    results: [
      ["0x3b91…0c4d", "#21,844,800", "0x7a2f…8b12", "0x9f3a…e1c4", "$280,000", "transfer", "Mixer", "1"],
      ["0x77ad…9e21", "#21,844,600", "0xb4e1…3f72", "0x5c89…d2a7", "$138,000", "transfer", "Mixer", "1"],
      ["0x92c4…1a8f", "#21,843,100", "0x3d7e…c941", "0x8f2b…4e63", "$214,500", "swapExact…", "Mixer-adj", "2"],
    ],
    status: "flag",
    findings: ["AUR-03"],
    assertions: ["Completeness"],
    summary: "3 transactions totaling $632.5K trace within 2 hops of tagged mixer contracts. All linked to finding AUR-03 — source-of-funds documentation required before revenue recognition.",
    followups: [
      "Trace the full fund-flow path for the $280K transfer",
      "Which Aurora wallets received these mixer-adjacent funds?",
      "Are any of these counterparties on the OFAC SDN list?",
    ],
  },
  {
    id: "nlq-2",
    query: "Which contracts have single-key admin privileges?",
    ts: "2026-06-08 13:50",
    intent: "Identify smart contracts where admin/owner is an externally-owned account (EOA) rather than a multisig, indicating centralization risk.",
    sql: `SELECT c.name, c.address, c.proxy_type, c.admin_addr,\n       c.admin_type, c.centralization_risk,\n       ARRAY_AGG(p.function_name) AS privileged_fns\nFROM   contracts c\nJOIN   privileged_functions p ON c.address = p.contract\nWHERE  c.admin_type = 'EOA'\n  AND  c.client_id = 'aurora'\nGROUP BY c.name, c.address, c.proxy_type,\n         c.admin_addr, c.admin_type, c.centralization_risk;`,
    cols: ["Contract", "Address", "Proxy", "Admin", "Type", "Risk", "Privileges"],
    results: [
      ["LendingPool", "0x4c7b…2d91", "Transparent", "0x9f…3aE1", "EOA", "High", "pause, upgrade, setOracle"],
      ["RewardsDistributor", "0x88e2…1c0f", "Unknown", "0x4c…7B2d", "EOA", "High", "setMerkleRoot, sweep"],
    ],
    status: "flag",
    findings: ["AUR-01", "AUR-02"],
    assertions: ["Presentation & Disclosure", "Rights & Obligations"],
    summary: "2 contracts controlled by single-key EOAs: LendingPool (can pause withdrawals + upgrade logic) and RewardsDistributor (can sweep unclaimed rewards). Both represent significant centralization risk — findings AUR-01 and AUR-02.",
    followups: [
      "Has the LendingPool admin key ever called pause()?",
      "What's the total value at risk from single-key contracts?",
      "Show the upgrade history for RewardsDistributor",
    ],
  },
  {
    id: "nlq-3",
    query: "Summarize unreconciled balances across all chains",
    ts: "2026-06-08 11:15",
    intent: "Aggregate token balances per chain where on-chain state does not match the audit ledger, including the delta amount.",
    sql: `SELECT chain, COUNT(DISTINCT wallet) AS wallets,\n       SUM(onchain_balance_usd) AS onchain,\n       SUM(ledger_balance_usd) AS ledger,\n       SUM(onchain_balance_usd - ledger_balance_usd) AS delta\nFROM   reconciliation_state\nWHERE  status = 'unreconciled'\n  AND  client_id = 'aurora'\nGROUP BY chain\nORDER BY ABS(delta) DESC;`,
    cols: ["Chain", "Wallets", "On-chain", "Ledger", "Delta"],
    results: [
      ["Polygon", "1", "$2,000,000", "$2,014,200", "−$14,200"],
      ["Ethereum", "1", "$12,004,991", "$12,004,991", "$0 *"],
    ],
    status: "flag",
    findings: [],
    assertions: ["Existence", "Valuation"],
    summary: "Polygon shows a −$14.2K unreconciled delta across 1 wallet. Ethereum has 1 position (aUSDC receipt token) with matching balance but pending measurement review. Total unreconciled: $14.2K.",
    followups: [
      "What caused the $14.2K Polygon discrepancy?",
      "Show the aUSDC interest accrual calculation",
      "When was the last successful Polygon reconciliation?",
    ],
  },
];

// Typing simulation phrases
const NLQ_THINKING_PHASES = [
  "Parsing query intent…",
  "Mapping to audit schema…",
  "Generating SQL procedure…",
  "Executing against erigon-mainnet-04…",
  "Cross-referencing findings & assertions…",
  "Preparing results…",
];

Object.assign(window.ADATA, {
  NLQ_SUGGESTED, NLQ_HISTORY, NLQ_THINKING_PHASES,
});
