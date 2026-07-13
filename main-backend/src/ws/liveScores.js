// PURPOSE: The second API paradigm — a WebSocket that PUSHES live match
// scores to connected clients (REST is request/response, this is server push).
//
// WHAT THIS FILE DOES:
//   1. Open a WebSocket server on /ws/live
//   2. On connection, verify the JWT passed as ?token= (close 4401 if invalid)
//   3. Every 60s, fetch the latest matches and push them to all clients
//   4. Send the last known state immediately to a newly connected client
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
