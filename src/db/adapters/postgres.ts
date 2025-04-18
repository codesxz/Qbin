import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { schema } from "../schema.ts";
import { get_env } from "../../config/env.ts";
import { registerAdapter } from "./registry.ts";
import { withRetry } from "../utils/retry.ts";

const { Pool } = pg;

function newPool() {
  return new Pool({
    connectionString: get_env("DATABASE_URL") ?? "",
    idleTimeoutMillis: Number(get_env("PG_IDLE_TIMEOUT")  ?? 30_000),
    connectionTimeoutMillis: Number(get_env("PG_CONN_TIMEOUT") ?? 5_000),
  });
}

registerAdapter("postgres", async () => {
  let pool = newPool();

  pool.on("error", async (err) => {
    console.error("[postgres] pool error – reconnecting", err);
    try { await pool.end(); } catch (_) {}
    pool = newPool();
  });

  const db = drizzle(pool, { schema });

  await withRetry(() => db.execute("SELECT 1"));

  return { db, close: () => pool.end() };
});