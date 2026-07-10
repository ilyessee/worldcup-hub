import { WebSocketServer } from "ws";
import { verifyToken } from "../auth/jwt.js";
import { getLiveMatches } from "../services/fifaClient.js";

const POLL_INTERVAL_MS = 60_000;

// Second API paradigm: WebSocket push. Clients connect with
// ws://host/ws/live?token=<jwt> and receive live match updates.
export function attachLiveScores(server) {
  const wss = new WebSocketServer({ server, path: "/ws/live" });
  let lastPayload = null;

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    try {
      verifyToken(url.searchParams.get("token") || "");
    } catch {
      socket.close(4401, "Access denied: invalid or missing JWT");
      return;
    }
    if (lastPayload) socket.send(lastPayload);
  });

  async function poll() {
    try {
      const matches = await getLiveMatches();
      lastPayload = JSON.stringify({ type: "matches", at: new Date().toISOString(), matches });
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(lastPayload);
      }
    } catch (err) {
      console.error("live scores poll failed:", err.message);
    }
  }

  poll();
  setInterval(poll, POLL_INTERVAL_MS);
  return wss;
}
