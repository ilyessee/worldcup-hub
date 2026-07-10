import express from "express";
import cors from "cors";
import http from "node:http";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { apiRouter } from "./routes/api.js";
import { attachLiveScores } from "./ws/liveScores.js";

const app = express();
app.use(cors({ origin: config.frontendUrl }));
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
