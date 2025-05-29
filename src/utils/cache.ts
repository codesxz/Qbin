/**
 * 多级缓存管理
 * - 内存 (memCache)
 * - Deno KV (for meta) + Postgres (最终存储)
 */
import {
  CACHE_CHANNEL,
  DENO_KV_ACCESS_TOKEN,
  DENO_KV_PROJECT_ID,
  DENO_KV_PROJECT_ID_REGEX,
  MAX_CACHE_SIZE,
  PASTE_STORE
} from "../config/constants.ts";
import { Metadata } from "../utils/types.ts";
import { checkPassword } from "./validator.ts";

// caches 设置age过期清理存在延时，delete立即删除，分布式系统不会同步缓存状态

export const memCache = new Map<string, Metadata | Record<string, unknown>>();
export const cache = await caches.open("qbinv7");
export const kv = await ((() => {
  const projectId = DENO_KV_PROJECT_ID?.trim() || "";
  const accessToken = DENO_KV_ACCESS_TOKEN?.trim() || "";

  if (projectId && accessToken && DENO_KV_PROJECT_ID_REGEX.test(projectId)) {
    return Deno.openKv(`https://api.deno.com/databases/${projectId}/connect`, {
      accessToken: accessToken,
    });
  }
  return Deno.openKv();
})());
export const cacheBroadcast = new BroadcastChannel(CACHE_CHANNEL);


cacheBroadcast.onmessage = async (event: MessageEvent) => {
  const { type, key, metadata } = event.data;
  if (!key) return;
  if (type === "update" && key) {
    await deleteCache(key, metadata);
  } else if (type === "delete" && key) {
    await deleteCache(key, metadata);
  }
};

export async function isCached(key: string, pwd?: string | undefined, repo): Promise<Metadata | null> {
  const memData = memCache.get(key);
  if (memData && "pwd" in memData) {
    if ("pwd" in memData) return memData;
  }

  const cacheKey = new Request(`http://qbinv7/p/${key}`);
  console.log(key);
  console.log(cacheKey);
  const cacheData = await cache.match(cacheKey);
  if (cacheData){
    const content = await cacheData.arrayBuffer();
    if(content !== null) {
      const headers = cacheData.headers;
      const metadata: Metadata = {
        fkey: key,
        title: headers.get("x-title") ?? "",
        time: parseInt(headers.get("x-time") ?? "0"),
        expire: parseInt(headers.get("x-expire") ?? "-1"),
        ip: headers.get("x-ip") ?? "",
        content: content,
        mime: headers.get("Content-Type") ?? "application/octet-stream",
        len: parseInt(headers.get("Content-Length") ?? "0"),
        pwd: headers.get("x-pwd") || "",
        email: headers.get("x-email") || "",
        uname: headers.get("x-uname") ?? undefined,
        hash: parseInt(headers.get("x-hash") ?? "0"),
      };
      memCache.set(key, metadata);
      return metadata;
    }
  }

  const kvResult = await kv.get([PASTE_STORE, key]);
  if (!kvResult.value){
    return null;
  }

  // kv不同步
  memCache.set(key, kvResult.value);   // 减少内查询
  return kvResult.value;
}

export async function checkCached(key: string, pwd?: string | undefined, repo): Promise<Metadata | null> {
  const memData = memCache.get(key);
  if (memData && "pwd" in memData) {
    if (!checkPassword(memData.pwd, pwd)) return null;
    if ("content" in memData) return memData;
  }

  const cacheKey = new Request(`http://qbinv7/p/${key}`);
  const cacheData = await cache.match(cacheKey);
  if (cacheData) {
    const headers = cacheData.headers;
    const content = await cacheData.arrayBuffer();
    if(content !== null){
      const metadata: Metadata = {
        fkey: key,
        title: headers.get("x-title") ?? "",
        time: parseInt(headers.get("x-time") ?? "0"),
        expire: parseInt(headers.get("x-expire") ?? "-1"),
        ip: headers.get("x-ip") ?? "",
        content: content,
        mime: headers.get("Content-Type") ?? "application/octet-stream",
        len: parseInt(headers.get("Content-Length") ?? "0"),
        pwd: headers.get("x-pwd") || "",
        email: headers.get("x-email") || "",
        uname: headers.get("x-uname") ?? undefined,
        hash: parseInt(headers.get("x-hash") ?? "0"),
      };
      memCache.set(key, metadata);
      return metadata;
    }
  } else if(memData && "pwd" in memData) {
    return memData;
  }

  const kvResult = await kv.get([PASTE_STORE, key]);
  if (!kvResult.value){
    return null;
  }
  if (!checkPassword(kvResult.value.pwd, pwd)){
    return null;
  }
  return kvResult.value;
}

/**
 * 从缓存中获取数据，如果缓存未命中，则从 KV 中获取并缓存
 */
export async function getCachedContent(key: string, pwd?: string, repo): Promise<Metadata | null> {
  try {
    const cache = await checkCached(key, pwd, repo);
    if (cache === null) return cache;
    if ("content" in cache) return cache;

    const dbData = await repo.getByFkey(key);
    if (!dbData) return null;
    await updateCache(key, dbData);
    return dbData;
  } catch (error) {
    console.error('Cache fetch error:', error);
    return null;
  }
}

/**
 * 更新缓存（写入内存和 Cache API）
 */
export async function updateCache(key: string, metadata: Metadata): Promise<void> {
  try {
    if(metadata.len <= MAX_CACHE_SIZE) memCache.set(key, metadata);
    if (metadata.len > 5242880) return;
    const cacheKey = new Request(`http://qbinv7/p/${key}`);
    const headers = {
      'Content-Type': metadata.mime,
      'Content-Length': metadata.len,
      'Cache-Control': 'max-age=604800',
      'x-title': metadata.title,
      'x-time': metadata.time,
      'x-expire': metadata.expire,
      'x-ip': metadata.ip,
      'x-pwd': metadata.pwd || "",
      'x-fkey': key,
      'x-email': metadata.email,
      "x-uname": metadata.uname || "",
      "x-hash": metadata.hash || "",
    }
    const content = metadata.content || new Uint8Array(0);
    await cache.put(cacheKey, new Response(content, { headers }));
  } catch (error) {
    console.error('Cache update error:', error);
  }
}

/**
 * 删除缓存 (内存 + Cache API)
 */
export async function deleteCache(key: string, meta) {
  try {
    memCache.delete(key);
    await cache.delete(`http://qbinv7/p/${key}`);
  } catch (error) {
    console.error('Cache deletion error:', error);
  }
}
