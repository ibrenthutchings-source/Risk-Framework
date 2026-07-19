import IORedis from "ioredis";
import { config } from "./config";

// Separate from the BullMQ connection (worker/queues.ts) — this one is only
// ever used to PUBLISH. Subscribers get their own dedicated connection each
// (see the SSE route), since ioredis puts a connection in subscribe-only
// mode once it calls SUBSCRIBE.
const feedPublisher = new IORedis(config.redisUrl);

export function feedChannel(engagementId: string): string {
  return `feed:${engagementId}`;
}

export async function publishFeedEvent(engagementId: string, event: unknown): Promise<void> {
  await feedPublisher.publish(feedChannel(engagementId), JSON.stringify(event));
}
