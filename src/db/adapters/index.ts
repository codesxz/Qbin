export { getDb, registerAdapter, closeAllDb } from "./registry.ts";

export type SupportedDialect = "postgres" | "sqlite";
