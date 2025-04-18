import { get_env } from "../../config/env.ts";

export type DrizzleDB = any;            // drizzle 数据库实例

type DbInstance = { db: DrizzleDB; close?: () => Promise<void> | void };
type FactoryFn  = () => Promise<DbInstance>;

const factories  = new Map<string, FactoryFn>();
const instances  = new Map<string, DbInstance>();

export function registerAdapter(name: string, factory: FactoryFn) {
  factories.set(name.toLowerCase(), factory);
}

/** 内部解析方言优先级：实参 > 环境变量 > postgres */
function resolveDialect(d?: string) {
  return (d ?? get_env("DB_CLIENT") ?? "postgres").toLowerCase();
}

/** 统一的单例获取入口 */
export async function getDb(dialect?: string) {
  const d = resolveDialect(dialect);
  if (!instances.has(d)) {
    await import(`./${d}.ts`);  // 动态加载数据库

    const ctor = factories.get(d);
    if (!ctor) throw new Error(`Unsupported DB_CLIENT "${d}"`);
    instances.set(d, await ctor());
  }
  const db = instances.get(d)!.db;
  return db;
}

export async function closeAllDb() {
  await Promise.all([...instances.values()].map((i) => i.close?.()));
}