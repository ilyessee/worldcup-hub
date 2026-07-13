// PURPOSE: Entry point of the main backend / API gateway — the only
// service exposed to the outside world.
//
// WHAT THIS FILE DOES:
//   1. Configure CORS (only the frontend / any localhost port is accepted)
//   2. Mount the /auth routes (Google login, JWT) and /api/v1 routes (business API)
//   3. Expose a /health check and a catch-all 404 handler
//   4. Centralized error handler (clean JSON, never leaks a stack trace)
//   5. Attach the WebSocket server (/ws/live) and start listening
import express from "express";
import cors from "cors";
import http from "node:http";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { apiRouter } from "./routes/api.js";
import { attachLiveScores } from "./ws/liveScores.js";

const app = express();
// Allow the configured frontend plus any localhost port during development
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === config.frontendUrl || /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "main-backend" }));

app.use("/auth", authRouter);
app.use("/api/v1", apiRouter);

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.path}` }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const server = http.createServer(app);
attachLiveScores(server);

server.listen(config.port, () => {
  console.log(`main-backend listening on :${config.port}`);
  console.log(`  REST API : http://localhost:${config.port}/api/v1`);
  console.log(`  WebSocket: ws://localhost:${config.port}/ws/live?token=<jwt>`);
});
