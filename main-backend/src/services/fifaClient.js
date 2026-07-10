import { config } from "../config.js";

// External API integration: the FIFA World Cup MLOps backend
// (our other project, deployed on Render) serves the ML predictions.
export async function predictMatch({ homeTeam, awayTeam, stage }) {
  const response = await fetch(`${config.fifaApiUrl}/predict`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      home_team: homeTeam,
      away_team: awayTeam,
      stage: stage || "GROUP_STAGE",
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.detail || "Prediction service unavailable");
    error.status = response.status === 404 ? 400 : 502;
    throw error;
  }
  return body;
}

export async function getLiveMatches() {
  const response = await fetch(`${config.fifaApiUrl}/matches`);
  if (!response.ok) throw new Error("Matches service unavailable");
  return response.json();
}
