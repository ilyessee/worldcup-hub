"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch, clearToken, getToken } from "@/lib/api";

const TEAMS = [
  "Argentina", "Brazil", "France", "England", "Spain", "Germany",
  "Portugal", "Netherlands", "Belgium", "Croatia", "Morocco", "Uruguay",
  "Colombia", "USA", "Mexico", "Japan", "Senegal", "Switzerland",
];

// The matches API returns teams as objects ({name, crest}); predictions use plain strings
function teamName(team) {
  if (!team) return "?";
  return typeof team === "string" ? team : team.name || "?";
}

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "LIVE"]);

// Order matches for display: live first, then the next 2 scheduled
// matches with known teams, then the most recent results.
function buildMatchList(all) {
  const dateOf = (m) => new Date(m.utc_date ?? m.utcDate ?? 0).getTime();
  const hasTeams = (m) =>
    teamName(m.home_team ?? m.homeTeam) !== "?" &&
    teamName(m.away_team ?? m.awayTeam) !== "?";

  const live = all.filter((m) => LIVE_STATUSES.has(m.status));
  const upcoming = all
    .filter((m) => !LIVE_STATUSES.has(m.status) && m.status !== "FINISHED" && hasTeams(m))
    .sort((a, b) => dateOf(a) - dateOf(b))
    .slice(0, 2);
  const finished = all
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => dateOf(b) - dateOf(a));

  return [...live, ...upcoming, ...finished].slice(0, 8);
}

const STAGES = [
  ["GROUP_STAGE", "Group stage"],
  ["ROUND_OF_16", "Round of 16"],
  ["QUARTER_FINALS", "Quarter finals"],
  ["SEMI_FINALS", "Semi finals"],
  ["FINAL", "Final"],
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [liveMatches, setLiveMatches] = useState(null);
  const [form, setForm] = useState({ homeTeam: "France", awayTeam: "Argentina", stage: "GROUP_STAGE" });
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const loadUserData = useCallback(async () => {
    const [favs, hist] = await Promise.all([
      apiFetch("/api/v1/favorites"),
      apiFetch("/api/v1/history"),
    ]);
    setFavorites(favs);
    setHistory(hist);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Route protection: no token, straight back to the login page
      router.replace("/");
      return;
    }

    apiFetch("/auth/me")
      .then((me) => {
        setUser(me);
        return loadUserData();
      })
      .catch(() => {});

    // Live scores over WebSocket (2nd API paradigm)
    const wsUrl = API_URL.replace(/^http/, "ws");
    const socket = new WebSocket(`${wsUrl}/ws/live?token=${token}`);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "matches") setLiveMatches(data);
      } catch {}
    };
    wsRef.current = socket;
    return () => socket.close();
  }, [router, loadUserData]);

  async function predict(event) {
    event.preventDefault();
    setError(null);
    setPredicting(true);
    setPrediction(null);
    try {
      const result = await apiFetch("/api/v1/predict", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setPrediction(result);
      apiFetch("/api/v1/history").then(setHistory).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setPredicting(false);
    }
  }

  async function addFavorite(team) {
    try {
      await apiFetch("/api/v1/favorites", {
        method: "POST",
        body: JSON.stringify({ team }),
      });
      setFavorites(await apiFetch("/api/v1/favorites"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeFavorite(team) {
    await apiFetch(`/api/v1/favorites/${encodeURIComponent(team)}`, { method: "DELETE" });
    setFavorites(await apiFetch("/api/v1/favorites"));
  }

  function logout() {
    clearToken();
    router.replace("/");
  }

  if (!user) return <p className="muted">Loading…</p>;

  const favoriteTeams = new Set(favorites.map((f) => f.team));
  const probas = prediction?.probabilities;

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div>
            <div className="site-title">
              WorldCup Hub <span className="accent">2026</span>
            </div>
            <p className="site-subtitle">
              Prédictions ML, équipes favorites et scores en direct.
            </p>
          </div>
          <div className="row">
            <span className="muted">{user.name || user.email}</span>
            <button className="btn secondary small" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>

      <main>
      <div className="grid">
        <section className="panel">
          <h2>🎮 Match predictor</h2>
          <p className="hint">Choisis deux équipes pour voir ce que prédit le modèle.</p>
          <form onSubmit={predict}>
            <div className="row">
              <select
                value={form.homeTeam}
                onChange={(e) => setForm({ ...form, homeTeam: e.target.value })}
              >
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <span className="vs">VS</span>
              <select
                value={form.awayTeam}
                onChange={(e) => setForm({ ...form, awayTeam: e.target.value })}
              >
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
              >
                {STAGES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button className="btn small" disabled={predicting}>
                {predicting ? "Predicting…" : "Predict"}
              </button>
            </div>
          </form>
          {error && <p className="error">{error}</p>}
          {prediction && (
            <div className="result-box">
              <strong>
                {prediction.prediction === "home_win" && `${form.homeTeam} wins`}
                {prediction.prediction === "away_win" && `${form.awayTeam} wins`}
                {prediction.prediction === "draw" && "Draw"}
              </strong>
              {probas && (
                <>
                  <div className="proba-bar">
                    <div style={{ width: `${probas.home_win * 100}%`, background: "#34d399" }} />
                    <div style={{ width: `${probas.draw * 100}%`, background: "#6b7280" }} />
                    <div style={{ width: `${probas.away_win * 100}%`, background: "#fbbf24" }} />
                  </div>
                  <p className="muted" style={{ marginTop: "0.4rem" }}>
                    {form.homeTeam} {(probas.home_win * 100).toFixed(1)}% · draw{" "}
                    {(probas.draw * 100).toFixed(1)}% · {form.awayTeam}{" "}
                    {(probas.away_win * 100).toFixed(1)}%
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>⭐ My favorite teams</h2>
          {favorites.length === 0 && <p className="muted">No favorites yet.</p>}
          <div>
            {favorites.map((f) => (
              <span key={f.team} className="badge">
                {f.team}{" "}
                <a
                  style={{ cursor: "pointer", color: "var(--red-300)" }}
                  onClick={() => removeFavorite(f.team)}
                >
                  ×
                </a>
              </span>
            ))}
          </div>
          <p className="muted" style={{ margin: "0.75rem 0 0.4rem" }}>Add a team:</p>
          <div>
            {TEAMS.filter((t) => !favoriteTeams.has(t)).slice(0, 8).map((t) => (
              <span
                key={t}
                className="badge clickable"
                onClick={() => addFavorite(t)}
              >
                + {t}
              </span>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>📺 Live matches</h2>
          {!liveMatches && <p className="muted">Waiting for live data…</p>}
          {liveMatches && (
            <>
              <p className="muted">Updated {new Date(liveMatches.at).toLocaleTimeString()}</p>
              <ul className="clean">
                {buildMatchList(liveMatches.matches?.matches || liveMatches.matches || [])
                  .map((m, i) => (
                    <li key={i}>
                      <span className="team">
                        {m.home_team?.crest && <img src={m.home_team.crest} alt="" />}
                        {teamName(m.home_team ?? m.homeTeam)}
                        <span className="vs">vs</span>
                        {m.away_team?.crest && <img src={m.away_team.crest} alt="" />}
                        {teamName(m.away_team ?? m.awayTeam)}
                      </span>
                      <span className="muted">
                        {m.status === "FINISHED" || LIVE_STATUSES.has(m.status)
                          ? `${m.status} ${m.home_score ?? ""}–${m.away_score ?? ""}`
                          : new Date(m.utc_date ?? m.utcDate).toLocaleString(undefined, {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel">
          <h2>🕘 My prediction history</h2>
          {history.length === 0 && <p className="muted">No predictions yet.</p>}
          <ul className="clean">
            {history.slice(0, 8).map((h) => (
              <li key={h._id}>
                <span>{h.homeTeam} vs {h.awayTeam}</span>
                <span className="muted">{h.prediction}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      </main>
    </>
  );
}
