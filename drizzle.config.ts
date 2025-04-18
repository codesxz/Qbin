import { defineConfig } from "drizzle-kit";

const url = Deno.env.get("DATABASE_URL")!
export default defineConfig({
  dialect: "postgresql",  // sqlite
  schema: "./src/db/models/*.ts",
  out: "./drizzle",
  dbCredentials: {
    url: url,
  }
});
