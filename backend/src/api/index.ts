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

// Hand-rolled rather than the `cors` package — auth here is a Bearer
// token, not a cookie, so there's no ambient credential for a wildcard
// origin to leak; CORS is just what lets a browser-hosted frontend call
// this API cross-origin at all, it isn't doing any of the actual
// authorization work.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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

// Friendly root response — otherwise a bare "/" falls through to the
// routers below and gets swallowed by their auth middleware, returning a
// confusing 401 instead of a clean 404/200.
app.get("/", (_req, res) => {
  res.json({ service: "chainproof-api", status: "ok", health: "/health" });
});

// Browsers auto-request this on every page load; silence the harmless
// console 404 it'd otherwise produce on an API with no static assets.
app.get("/favicon.ico", (_req, res) => res.sendStatus(204));

// Mounted under /v1 (not bare app.use(router)) so a request that doesn't
// start with /v1 — like "/" or a stray asset request — never enters these
// routers at all, instead of hitting their internal requireAuth/.use()
// middleware and coming back as a misleading 401.
app.use("/v1", authRouter);
app.use("/v1", engagementsRouter);
app.use("/v1", findingsRouter);
app.use("/v1", signoffsRouter);
app.use("/v1", queriesRouter);
app.use("/v1", workpapersRouter);

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
