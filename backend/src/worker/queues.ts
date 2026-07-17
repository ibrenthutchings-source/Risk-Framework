import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";

export const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const QUEUE_NAMES = {
  alertRuleEvaluation: "alert-rule-evaluation",
  duneExecution: "dune-execution",
  blockSyncPolling: "block-sync-polling",
  workpaperGeneration: "workpaper-generation",
} as const;

export const alertRuleQueue = new Queue(QUEUE_NAMES.alertRuleEvaluation, { connection });
export const duneExecutionQueue = new Queue(QUEUE_NAMES.duneExecution, { connection });
export const blockSyncQueue = new Queue(QUEUE_NAMES.blockSyncPolling, { connection });
export const workpaperQueue = new Queue(QUEUE_NAMES.workpaperGeneration, { connection });

export interface DuneExecutionJob {
  executionId: string;
  queryId: string;
  firmId: string;
  engagementId: string | null;
  params: Record<string, unknown>;
}

export interface WorkpaperJob {
  jobId: string;
  firmId: string;
  engagementId: string;
  sections: string[];
  format: "pdf" | "xlsx" | "docx";
}
