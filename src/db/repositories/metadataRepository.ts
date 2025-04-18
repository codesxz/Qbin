import { eq, and, gt, sql as dsql, count } from "drizzle-orm";
import { Metadata } from "../../types.ts";
import { IMetadataRepository } from "./IMetadataRepository.ts";
import { getDb, SupportedDialect } from "../adapters/index.ts";
import { metadataPg, metadataSqlite } from "../models/metadata.ts";
import { withRetry } from "../utils/retry.ts";
import { get_env } from "../../config/env.ts";
import { getTimestamp } from "../../utils/common.ts";


const TABLE_MAP = {
  postgres: metadataPg,
  sqlite:   metadataSqlite,
} as const;

function currentDialect(): SupportedDialect {
  return (get_env("DB_CLIENT") as SupportedDialect) ?? "postgres";
}

export async function createMetadataRepository(
  dialect: SupportedDialect = currentDialect(),
): Promise<IMetadataRepository> {
  const db    = await getDb(dialect);
  const table = TABLE_MAP[dialect];
  return new MetadataRepository(db, table);
}


class MetadataRepository implements IMetadataRepository {
  constructor(private db: any, private t: any) {}

  private run<T>(fn: () => Promise<T>) {
    return withRetry(fn);
  }

  async create(data: Metadata) {
    const { fkey: _omit, ...updateSet } = data as any;
    const query = await this.run(() =>
      this.db
        .insert(this.t)
        .values(data)
        .onConflictDoUpdate({
          target: this.t.fkey,     // 也可以写成 [this.t.fkey]
          set:   updateSet,        // 冲突时要更新的字段
        })
        .execute(),
    );
    return (query.rowCount || query.rowsAffected) > 0;
  }

  async getByFkey(fkey: string) {
    const r = await this.run(() =>
      this.db.select().from(this.t).where(eq(this.t.fkey, fkey)).limit(1)
        .execute());
    return r.length ? (r[0] as Metadata) : null;
  }

  async list(limit = 10, offset = 0) {
    return await this.run(() =>
      this.db.select().from(this.t)
        .orderBy(dsql`${this.t.time} DESC`).limit(limit).offset(offset)
        .execute()) as Metadata[];
  }

  async update(fkey: string, patch: Partial<Metadata>) {
    if (!Object.keys(patch).length) return false;
    const upsertRow = { ...(patch as Metadata), fkey };
    const { fkey: _omit, ...updateSet } = upsertRow as any;

    const query = await this.run(() =>
      this.db
        .insert(this.t)
        .values(upsertRow)
        .onConflictDoUpdate({
          target: this.t.fkey,
          set: updateSet,
        })
        .execute(),
    );
    return (query.rowCount || query.rowsAffected) > 0;
  }

  async delete(fkey: string) {
    const res = await this.run(() =>
      this.db.delete(this.t).where(eq(this.t.fkey, fkey)).execute());
    const affected = (res as any).rowsAffected ?? (res as any).count ?? 0;
    return affected > 0;
  }

  async findByType(type: string) {
    return await this.run(() =>
      this.db.select().from(this.t).where(eq(this.t.type, type))
        .orderBy(dsql`${this.t.time} DESC`).execute()) as Metadata[];
  }

  async getAllFkeys() {
    const rows = await this.run(() =>
      this.db.select({ fkey: this.t.fkey }).from(this.t).execute());
    return rows.map((r: { fkey: string }) => r.fkey);
  }

  /** 获取邮箱全部 fkey */
  async getByEmailAllFkeys(email: string) {
    const rows = await this.run(() =>
      this.db.select({ fkey: this.t.fkey }).from(this.t)
        .where(eq(this.t.email, email)).execute());
    return rows.map((r: { fkey: string }) => r.fkey);
  }

  /** 普通用户分页查询 */
  async paginateByEmail(email: string, limit = 10, offset = 0) {
    const now = getTimestamp();

    const [{ total }] = await this.run(() =>
      this.db.select({ total: count() }).from(this.t)
        .where(and(eq(this.t.email, email), gt(this.t.expire, now)))
        .execute()) as [{ total: bigint | number }];
    const totalNumber = Number(total ?? 0);
    console.log(totalNumber)
    if (offset >= totalNumber) return { items: [], total: totalNumber };

    const items = await this.run(() =>
      this.db.select().from(this.t)
        .where(and(eq(this.t.email, email), gt(this.t.expire, now)))
        .orderBy(dsql`${this.t.time} DESC`).limit(limit).offset(offset)
        .execute()) as Metadata[];

    return { items, total: totalNumber };
  }

  /** 管理员查看全部未过期数据 */
  async listAlive(limit = 10, offset = 0) {
    const now = getTimestamp();

    const [{ total }] = await this.run(() =>
      this.db.select({ total: count() }).from(this.t)
        .where(gt(this.t.expire, now)).execute()) as [{ total: bigint | number }];
    const totalNumber = Number(total ?? 0);
    if (offset >= totalNumber) return { items: [], total: totalNumber };

    const items = await this.run(() =>
      this.db.select().from(this.t)
        .where(gt(this.t.expire, now))
        .orderBy(dsql`${this.t.time} DESC`).limit(limit).offset(offset)
        .execute()) as Metadata[];

    return { items, total: totalNumber };
  }
}