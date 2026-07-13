// PURPOSE: favorites-service — the microservice that owns favorites, prediction
// history and model-accuracy data in MongoDB.
//
// WHAT THIS FILE DOES:
//   1. Reject any request without the shared x-internal-token (403)
//   2. /favorites  (GET/POST/DELETE) -> a user's favorite teams
//   3. /history    (GET/POST)        -> a user's prediction history
//   4. /accuracy   (GET, /ids, /bulk)-> model prediction vs real result tracking
//   5. Connect to MongoDB and start listening
import express from "express";
import mongoose from "mongoose";
import { Favorite, PredictionHistory, MatchAccuracy } from "./models.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4002;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/favorites";
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || "change-me-internal-secret";

// Only the main backend may call this service, never the outside world.
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.get("x-internal-token") !== INTERNAL_API_TOKEN) {
    return res.status(403).json({ error: "Forbidden: internal service" });
  }
  next();
});

app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "favorites-service" })
);

app.get("/favorites/:userId", async (req, res) => {
  const favorites = await Favorite.find({ userId: Number(req.params.userId) }).sort({
    createdAt: -1,
  });
  res.json(favorites.map((f) => ({ team: f.team, addedAt: f.createdAt })));
});

app.post("/favorites", async (req, res) => {
  const { userId, team } = req.body;
  if (!userId || !team) {
    return res.status(400).json({ error: "userId and team are required" });
  }
  try {
    const favorite = await Favorite.create({ userId, team });
    res.status(201).json({ team: favorite.team, addedAt: favorite.createdAt });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Team already in favorites" });
    }
    throw err;
  }
});

app.delete("/favorites/:userId/:team", async (req, res) => {
  const { deletedCount } = await Favorite.deleteOne({
    userId: Number(req.params.userId),
    team: req.params.team,
  });
  if (!deletedCount) return res.status(404).json({ error: "Favorite not found" });
  res.json({ deleted: true });
});

app.get("/history/:userId", async (req, res) => {
  const history = await PredictionHistory.find({
    userId: Number(req.params.userId),
  })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(history);
});

app.post("/history", async (req, res) => {
  const { userId, homeTeam, awayTeam, stage, prediction, probabilities } = req.body;
  if (!userId || !homeTeam || !awayTeam) {
    return res.status(400).json({ error: "userId, homeTeam and awayTeam are required" });
  }
  const entry = await PredictionHistory.create({
    userId,
    homeTeam,
    awayTeam,
    stage,
    prediction,
    probabilities,
  });
  res.status(201).json(entry);
});

// --- Model accuracy tracking (prediction vs real result) ---

// Ids already evaluated, so the gateway skips re-predicting them
app.get("/accuracy/ids", async (_req, res) => {
  const rows = await MatchAccuracy.find({}, { matchId: 1, _id: 0 });
  res.json(rows.map((r) => r.matchId));
});

// Full report + summary stats
app.get("/accuracy", async (_req, res) => {
  const rows = await MatchAccuracy.find({}).sort({ playedAt: -1 });
  const total = rows.length;
  const correct = rows.filter((r) => r.correct).length;
  res.json({
    total,
    correct,
    accuracy: total ? correct / total : 0,
    matches: rows,
  });
});

// Upsert a batch of match evaluations
app.post("/accuracy/bulk", async (req, res) => {
  const { evaluations } = req.body;
  if (!Array.isArray(evaluations)) {
    return res.status(400).json({ error: "evaluations must be an array" });
  }
  const ops = evaluations.map((e) => ({
    updateOne: {
      filter: { matchId: e.matchId },
      update: { $set: e },
      upsert: true,
    },
  }));
  if (ops.length) await MatchAccuracy.bulkWrite(ops);
  res.json({ upserted: ops.length });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

mongoose
  .connect(MONGO_URL)
  .then(() => {
    app.listen(PORT, () => console.log(`favorites-service listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
