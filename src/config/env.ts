import { load } from "https://deno.land/std/dotenv/mod.ts";
const env = await load();

export function get_env(name){
  return Deno.env.get(name) || env[name]
}
