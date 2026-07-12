import { Router } from "express";
import { requireAuth } from "../auth/jwt.js";
import { favoritesService, accuracyService } from "../services/internal.js";
import { predictMatch, getLiveMatches } from "../services/fifaClient.js";

// "API as a Service": every route below requires a valid JWT.
// External consumers can call these endpoints with their token.
export const apiRouter = Router();
apiRouter.use(requireAuth);

// Teams come back from the matches API as { name, crest } objects
function teamName(team) {
  if (!team) return null;
  return typeof team === "string" ? team : team.name || null;
}

function resultFromScore(home, away) {
  if (home > away) return "home_win";
  if (home < away) return "away_win";
  return "draw";
}

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

// --- Model accuracy: prediction vs real result over played matches ---

// Read the stored report (fast, served from MongoDB)
apiRouter.get("/accuracy", async (_req, res, next) => {
  try {
    res.json(await accuracyService.report());
  } catch (err) {
    next(err);
  }
});

// Backtest: for every finished match not yet evaluated, ask the model
// for its prediction, compare it to the real result, and store it.
apiRouter.post("/accuracy/refresh", async (_req, res, next) => {
  try {
    const data = await getLiveMatches();
    const matches = data.matches || data || [];

    const finished = matches.filter(
      (m) =>
        m.status === "FINISHED" &&
        m.home_score != null &&
        m.away_score != null &&
        teamName(m.home_team) &&
        teamName(m.away_team)
    );

    const storedIds = new Set(await accuracyService.storedIds());
    const todo = finished.filter((m) => !storedIds.has(m.id));

    const evaluations = [];
    // Small concurrency so we don't hammer the external ML API
    const BATCH = 4;
    for (let i = 0; i < todo.length; i += BATCH) {
      const slice = todo.slice(i, i + BATCH);
      const results = await Promise.all(
        slice.map(async (m) => {
          const home = teamName(m.home_team);
          const away = teamName(m.away_team);
          try {
            const pred = await predictMatch({ homeTeam: home, awayTeam: away, stage: m.stage });
            const actual = resultFromScore(m.home_score, m.away_score);
            return {
              matchId: m.id,
              homeTeam: home,
              awayTeam: away,
              stage: m.stage,
              homeScore: m.home_score,
              awayScore: m.away_score,
              actualResult: actual,
              predictedResult: pred.prediction,
              correct: actual === pred.prediction,
              probabilities: pred.probabilities,
              playedAt: m.utc_date,
            };
          } catch {
            return null; // skip matches the model can't score (unknown team, etc.)
          }
        })
      );
      evaluations.push(...results.filter(Boolean));
    }

    if (evaluations.length) await accuracyService.saveBulk(evaluations);
    res.json(await accuracyService.report());
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
