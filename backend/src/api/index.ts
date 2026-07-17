import express, { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { pool } from "../db";
import { connection as redisConnection } from "../worker/queues";
import { authRouter } from "../routes/auth";
import { engagementsRouter } from "../routes/engagements";
import { findingsRouter } from "../routes/findings";
import { signoffsRouter } from "../routes/signoffs";
import { queriesRouter } from "../routes/queries";
import { workpapersRouter } from "../routes/workpapers";

const app = express();
app.use(express.json());

// Health check — Railway polls this before routing traffic to a replica.
// Only reports healthy once both DB and Redis connections are live.
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    if (redisConnection.status !== "ready" && redisConnection.status !== "connect") {
      await redisConnection.ping();
    }
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "unavailable", error: (err as Error).message });
  }
});

app.use(authRouter);
app.use(engagementsRouter);
app.use(findingsRouter);
app.use(signoffsRouter);
app.use(queriesRouter);
app.use(workpapersRouter);

app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "internal error";
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`chainproof api listening on :${config.port}`);
});
