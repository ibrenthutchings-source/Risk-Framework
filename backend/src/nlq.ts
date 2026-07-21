import { PoolClient } from "pg";
import { config } from "./config";

export interface NlqCitation {
  type: string;
  ref: string;
  note?: string;
}

export interface NlqResult {
  answer: string;
  citations: NlqCitation[];
  model: string;
}

/**
 * Grounds the LLM in this engagement's real recorded data instead of
 * letting it answer from general knowledge: pulls a bounded sample of
 * findings/feed_events/counterparty exposure/token holdings/contract
 * profiles, hands that JSON to Claude as the *only* source of truth, and
 * asks for a structured {answer, citations} response referencing specific
 * rows. If the model can't answer from the provided data it's instructed
 * to say so rather than invent on-chain facts.
 */
export async function answerNlq(client: PoolClient, engagementId: string, question: string): Promise<NlqResult> {
  const [findings, feed, counterparties, tokens, contracts] = await Promise.all([
    client.query(
      `SELECT id, title, severity, status, category, assertion, description, tx_hash, detected_at
       FROM findings WHERE engagement_id = $1 ORDER BY detected_at DESC LIMIT 25`,
      [engagementId]
    ),
    client.query(
      `SELECT chain, block_number, tx_hash, from_address, to_address, value_wei, direction, is_new_counterparty, severity, detected_at
       FROM feed_events WHERE engagement_id = $1 ORDER BY detected_at DESC LIMIT 25`,
      [engagementId]
    ),
    client.query(
      `SELECT chain,
              CASE WHEN direction = 'out' THEN to_address ELSE from_address END AS address,
              count(*)::int AS tx_count,
              sum(value_wei) AS total_value_wei
       FROM feed_events WHERE engagement_id = $1
       GROUP BY chain, address ORDER BY tx_count DESC LIMIT 15`,
      [engagementId]
    ),
    client.query(
      `SELECT symbol, name, standard, contract_address, held, value_usd, custody, reconciled
       FROM token_holdings WHERE engagement_id = $1 LIMIT 25`,
      [engagementId]
    ),
    client.query(
      `SELECT name, address, verified, proxy_type, centralization, severity
       FROM contract_profiles WHERE engagement_id = $1 LIMIT 25`,
      [engagementId]
    ),
  ]);

  const context = {
    findings: findings.rows,
    recent_transactions: feed.rows,
    counterparty_exposure: counterparties.rows,
    token_holdings: tokens.rows,
    contract_profiles: contracts.rows,
  };

  const system = `You are an audit assistant answering questions about a blockchain audit engagement. Use ONLY the JSON data provided in the user message as your source of truth — never invent on-chain facts, addresses, amounts, or findings not present in it. If the data doesn't contain enough information to answer, say so explicitly rather than guessing.

Respond with ONLY a JSON object of this exact shape, no other text, no markdown fences:
{"answer": "<plain-prose answer>", "citations": [{"type": "<finding|transaction|counterparty|token|contract>", "ref": "<the id, tx_hash, or address you're citing>", "note": "<why this supports the answer>"}]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.llm.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.llm.model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: `Question: ${question}\n\nData:\n${JSON.stringify(context)}` }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const body = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = body.content.find((c) => c.type === "text")?.text || "";

  try {
    const parsed = JSON.parse(text) as { answer: string; citations?: NlqCitation[] };
    return { answer: parsed.answer, citations: parsed.citations || [], model: config.llm.model };
  } catch {
    // Model didn't return valid JSON — surface its raw text rather than
    // erroring, since the answer itself may still be useful.
    return { answer: text, citations: [], model: config.llm.model };
  }
}
