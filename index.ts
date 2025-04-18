import { createServer } from "./src/server.ts";
import { get_env } from "./src/config/env.ts";

/**
 * 程序入口
 */
async function main() {
  const app = createServer();
  const PORT = parseInt(get_env("PORT")) || 8000;
  console.log(`Server is running on port ${PORT}...`);
  await app.listen({ port: PORT });
}

await main();
