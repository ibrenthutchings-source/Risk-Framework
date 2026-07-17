import { Worker } from "bullmq";
import { QUEUE_NAMES, alertRuleQueue, blockSyncQueue, connection } from "./queues";
import { processAlertRuleEvaluation } from "./processors/alertRuleEvaluation";
import { processDuneExecution } from "./processors/duneExecution";
import { processBlockSyncPolling } from "./processors/blockSyncPolling";
import { processWorkpaperGeneration } from "./processors/workpaperGeneration";

const workers = [
  new Worker(QUEUE_NAMES.alertRuleEvaluation, processAlertRuleEvaluation, { connection }),
  new Worker(QUEUE_NAMES.duneExecution, processDuneExecution, { connection, concurrency: 5 }),
  new Worker(QUEUE_NAMES.blockSyncPolling, processBlockSyncPolling, { connection }),
  new Worker(QUEUE_NAMES.workpaperGeneration, processWorkpaperGeneration, { connection, concurrency: 3 }),
];

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} failed:`, err);
  });
  worker.on("ready", () => console.log(`[${worker.name}] worker ready`));
}

// Recurring schedules for the two poll-driven jobs. Dune executions and
// workpaper generation are enqueued on demand by the API instead.
async function scheduleRepeatingJobs() {
  await alertRuleQueue.add(
    "evaluate",
    {},
    { repeat: { every: 60_000 }, jobId: "alert-rule-evaluation:recurring" }
  );
  await blockSyncQueue.add(
    "poll",
    {},
    { repeat: { every: 15_000 }, jobId: "block-sync-polling:recurring" }
  );
}

scheduleRepeatingJobs().catch((err) => {
  console.error("failed to schedule recurring jobs:", err);
  process.exit(1);
});

console.log("chainproof worker started");

process.on("SIGTERM", async () => {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
