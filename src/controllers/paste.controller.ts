import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  getCachedContent,
  isCached,
  updateCache,
  kv,
  memCache,
  cacheBroadcast,
} from "../utils/cache.ts";
import {
  getTimestamp,
  checkPassword,
  cyrb53,
} from "../utils/common.ts";
import { Response } from "../utils/response.ts";
import { ResponseMessages } from "../utils/messages.ts";
import { parsePathParams } from "../utils/validator.ts";
import {
  PASTE_STORE,
  MAX_UPLOAD_FILE_SIZE,
  mimeTypeRegex,
  reservedPaths,
} from "../config/constants.ts";
import { createMetadataRepository } from "../db/db.ts";
import { Metadata } from "../types.ts";
import type { AppState } from "../types.ts";

/** GET /r/:key/:pwd? 原始内容输出 */
export async function getRaw(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params);
  const repo = await createMetadataRepository();

  // 只查 meta，作用：无权限时提前返回 403/404
  const meta = await isCached(key, pwd, repo);
  if (meta?.email === undefined || (meta.expire ?? 0) < getTimestamp()) {
    throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  }
  if (meta.pwd && !checkPassword(meta.pwd, pwd)) {
    throw new Response(ctx, 403, ResponseMessages.PASSWORD_INCORRECT);
  }

  const full = await getCachedContent(key, pwd, repo);
  if (!(full && "content" in full)) {
    throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  }

  ctx.state.metadata = { etag: full.hash, time: full.time };
  ctx.response.headers.set("Pragma", "no-cache");
  ctx.response.headers.set("Cache-Control", "no-cache, must-revalidate");  // private , must-revalidate | , max-age=3600
  ctx.response.headers.set("Content-Type", full.type);
  ctx.response.headers.set("Content-Length", full.len.toString());
  ctx.response.body = full.content;
}

export async function queryRaw(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params);
  const repo = await createMetadataRepository();

  // 只查 meta，作用：无权限时提前返回 403/404
  const meta = await isCached(key, pwd, repo);
  if (meta?.email === undefined || (meta.expire ?? 0) < getTimestamp()) {
    throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  }
  if (meta.pwd && !checkPassword(meta.pwd, pwd)) {
    throw new Response(ctx, 403, ResponseMessages.PASSWORD_INCORRECT);
  }

  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", meta.type);
  ctx.response.headers.set("Content-Length", meta.len.toString());
}

/** POST/PUT /s/:key/:pwd? 统一入口：若 key 已存在则更新，否则创建 */
export async function save(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params);
  if (reservedPaths.has(key.toLowerCase())) {
    throw new Response(ctx, 403, ResponseMessages.PATH_RESERVED);
  }

  const repo = await createMetadataRepository();
  const meta = await isCached(key, pwd, repo);

  return meta && "email" in meta
    ? await updateExisting(ctx, key, pwd, meta, repo)
    : await createNew(ctx, key, pwd, repo);
}

/** DELETE /d/:key/:pwd? */
export async function remove(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params);
  if (reservedPaths.has(key.toLowerCase())) {
    throw new Response(ctx, 403, ResponseMessages.PATH_RESERVED);
  }

  const repo = await createMetadataRepository();
  const meta = await isCached(key, pwd, repo);
  if (!meta || (meta.expire ?? 0) < getTimestamp()) {
    throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  }
  if (!checkPassword(meta.pwd, pwd)) {
    throw new Response(ctx, 403, ResponseMessages.PASSWORD_INCORRECT);
  }

  const email = ctx.state.session?.get("user")?.email;
  if (email !== meta.email) {
    throw new Response(ctx, 403, ResponseMessages.PERMISSION_DENIED);
  }

  // 软删除
  meta.len = 0;
  if (meta.expire > 0) meta.expire = -meta.expire;
  await Promise.all([
    updateCache(key, meta),
    kv.set([PASTE_STORE, key], meta),
  ]);
  cacheBroadcast.postMessage({ type: "delete", key, metadata: meta });

  // 真删除丢给微任务
  queueMicrotask(async () => {
    await repo.update(key, { content: new Uint8Array(0), expire: meta.expire });
  });

  return new Response(ctx, 200, ResponseMessages.SUCCESS);
}

/* ─────────── 辅助私有函数 ─────────── */

async function createNew(
  ctx: Context<AppState>,
  key: string,
  pwd: string,
  repo,
) {
  const metadata = await assembleMetadata(ctx, key, pwd);
  // 原子性检查 + 占位
  const kvRes = await kv.atomic()
    .check({ key: [PASTE_STORE, key], versionstamp: null })
    .set([PASTE_STORE, key], {
      email: metadata.email,
      name: metadata.uname,
      ip: metadata.ip,
      len: metadata.len,
      expire: metadata.expire,
      hash: metadata.hash,
      pwd,
    }, { expireIn: null })
    .commit();
  if (!kvRes.ok) {
    return new Response(ctx, 409, ResponseMessages.KEY_EXISTS);
  }

  // 先写内存缓存
  memCache.set(key, metadata);

  queueMicrotask(async () => {
    try {
      await repo.create(metadata);
      await updateCache(key, metadata);
    } catch (err) {
      console.error(err);
      memCache.delete(key);
      await kv.delete([PASTE_STORE, key]);
    }
  });

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    key,
    pwd,
    url: `${ctx.request.url.origin}/r/${key}/${pwd}`,
  });
}

async function updateExisting(
  ctx: Context<AppState>,
  key: string,
  pwd: string,
  oldMeta,
  repo,
) {
  const email = ctx.state.session?.get("user")?.email;
  if (email !== oldMeta.email) {
    throw new Response(ctx, 403, ResponseMessages.PERMISSION_DENIED);
  }

  const metadata = await assembleMetadata(ctx, key, pwd);
  memCache.set(key, metadata);

  queueMicrotask(async () => {
    try {
      await repo.update(key, metadata);
      await updateCache(key, metadata);
      cacheBroadcast.postMessage({ type: "update", key, metadata });
    } catch (err) {
      console.error(err);
      memCache.set(key, oldMeta); // 回滚
    }
  });

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    key,
    pwd,
    url: `${ctx.request.url.origin}/r/${key}/${pwd}`,
  });
}

/** 把“读取请求体 → 构造 Metadata”封装，新增/更新共用 */
async function assembleMetadata(
  ctx: Context<AppState>,
  key: string,
  pwd: string,
): Promise<Metadata> {
  const req = ctx.request;
  const headers = req.headers;
  const len = +headers.get("Content-Length")!;
  if (len > MAX_UPLOAD_FILE_SIZE) {
    throw new Response(ctx, 413, ResponseMessages.CONTENT_TOO_LARGE);
  }
  const type = headers.get("Content-Type") ?? "application/octet-stream";
  if (!mimeTypeRegex.test(type)) {
    throw new Response(ctx, 415, ResponseMessages.INVALID_CONTENT_TYPE);
  }

  const content = await req.body.arrayBuffer();
  if (content.byteLength !== len) {
    throw new Response(ctx, 413, ResponseMessages.CONTENT_TOO_LARGE);
  }

  const payload = ctx.state.session?.get("user");
  return {
    fkey: key,
    time: getTimestamp(),
    expire: getTimestamp() +
      ~~(headers.get("x-expire") ?? "315360000"),
    ip: req.ip,
    content,
    type,
    len,
    pwd,
    email: payload?.email ?? "",
    uname: payload?.name ?? "",
    hash: cyrb53(content),
  };
}