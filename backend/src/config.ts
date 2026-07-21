import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  jwtSecret: required("JWT_SECRET"),
  dune: {
    apiKey: process.env.DUNE_API_KEY || "",
  },
  rpc: {
    url: process.env.RPC_PROVIDER_URL || "",
    apiKey: process.env.RPC_API_KEY || "",
    // Which wallets_contracts.chain value this single RPC endpoint serves —
    // block-sync-polling only tracks wallets on this chain.
    chain: process.env.RPC_CHAIN || "",
  },
  llm: {
    // Empty until set — NLQ checks this and returns 501 rather than a
    // fabricated answer when no key is configured.
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
  },
  storage: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    bucket: process.env.S3_BUCKET || "",
    endpoint: process.env.S3_ENDPOINT || "",
  },
};
