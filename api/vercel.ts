#!/usr/bin/env DENO_DIR=/tmp deno run --allow-net --allow-env --allow-read --unstable-kv --unstable-broadcast-channel

import { createServer } from "../src/server.ts";
import { get_env } from "../src/config/env.ts";

const app = createServer();
const PORT = parseInt(get_env("PORT")) || 8000;

// Vercel expects a handler function
export default async function handler(req: Request) {
  return await app.handle(req);
}