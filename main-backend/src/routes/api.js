import { Router } from "express";
import { requireAuth } from "../auth/jwt.js";
import { favoritesService } from "../services/internal.js";
import { predictMatch, getLiveMatches } from "../services/fifaClient.js";

// "API as a Service": every route below requires a valid JWT.
// External consumers can call these endpoints with their token.
export const apiRouter = Router();
apiRouter.use(requireAuth);

// --- Predictions (delegated to the external FIFA MLOps API) ---
apiRouter.post("/predict", async (req, res, next) => {
  try {
    const { homeTeam, awayTeam, stage } = req.body;
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: "homeTeam and awayTeam are required" });
    }
    const result = await predictMatch({ homeTeam, awayTeam, stage });

    // Log the prediction in the user's history (best effort)
    favoritesService
      .logPrediction({
        userId: req.user.sub,
        homeTeam,
        awayTeam,
        stage: stage || "GROUP_STAGE",
        prediction: result.prediction,
        probabilities: result.probabilities,
      })
      .catch((err) => console.error("history log failed:", err.message));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

apiRouter.get("/matches", async (_req, res, next) => {
  try {
    res.json(await getLiveMatches());
  } catch (err) {
    next(err);
  }
});

// --- Favorites (delegated to favorites-service / MongoDB) ---
apiRouter.get("/favorites", async (req, res, next) => {
  try {
    res.json(await favoritesService.list(req.user.sub));
  } catch (err) {
    next(err);
  }
});

apiRouter.post("/favorites", async (req, res, next) => {
  try {
    if (!req.body.team) return res.status(400).json({ error: "team is required" });
    res.status(201).json(await favoritesService.add(req.user.sub, req.body.team));
  } catch (err) {
    next(err);
  }
});

apiRouter.delete("/favorites/:team", async (req, res, next) => {
  try {
    res.json(await favoritesService.remove(req.user.sub, req.params.team));
  } catch (err) {
    next(err);
  }
});

// --- Prediction history ---
apiRouter.get("/history", async (req, res, next) => {
  try {
    res.json(await favoritesService.history(req.user.sub));
  } catch (err) {
    next(err);
  }
});
