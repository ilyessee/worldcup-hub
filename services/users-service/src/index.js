import express from "express";
import { pool, initSchema } from "./db.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4001;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || "change-me-internal-secret";

// Only the main backend may call this service, never the outside world.
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.get("x-internal-token") !== INTERNAL_API_TOKEN) {
    return res.status(403).json({ error: "Forbidden: internal service" });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "users-service" }));

// Create the user on first login, refresh profile fields afterwards
app.post("/users/upsert", async (req, res) => {
  const { googleId, email, name, picture } = req.body;
  if (!googleId || !email) {
    return res.status(400).json({ error: "googleId and email are required" });
  }
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name, picture)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id)
     DO UPDATE SET email = $2, name = $3, picture = $4
     RETURNING id, google_id, email, name, picture, created_at`,
    [googleId, email, name || null, picture || null]
  );
  res.json(rows[0]);
});

app.get("/users/:id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, google_id, email, name, picture, created_at FROM users WHERE id = $1",
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`users-service listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to init schema:", err);
    process.exit(1);
  });
