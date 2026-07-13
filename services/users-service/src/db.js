// PURPOSE: PostgreSQL connection pool and schema for users-service.
//
// WHAT THIS FILE DOES:
//   1. Open a connection pool to PostgreSQL (from DATABASE_URL)
//   2. initSchema() -> create the "users" table if it doesn't exist,
//      with a UNIQUE constraint on google_id
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://worldcup:worldcup@localhost:5432/users",
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
