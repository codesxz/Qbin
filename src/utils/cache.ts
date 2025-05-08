/**
 * 多级缓存管理
 * - 内存 (memCache)
 * - Deno KV (for meta) + Postgres (最终存储)
 */
import { Metadata } from "../utils/types.ts";
import { PASTE_STORE, CACHE_CHANNEL, MAX_CACHE_SIZE } from "../config/constants.ts";
import { checkPassword } from "./validator.ts";

export const memCache = new Map<string, Metadata | Record<string, unknown>>();
export const cache = await caches.open("qbinv1.4");
export const kv = await Deno.openKv();
export const cacheBroadcast = new BroadcastChannel(CACHE_CHANNEL);

cacheBroadcast.onmessage = async (event: MessageEvent) => {
  const { type, key, metadata } = event.data;
  if (!key) return;
  if (type === "update" && key && metadata) {
    await updateCache(key, metadata);
  } else if (type === "delete" && key) {
    await updateCache(key, metadata);
  }
};

export async function isCached(key: string, pwd?: string | undefined, repo): Promise<Metadata | null> {
  const memData = memCache.get(key);
  if (memData && "pwd" in memData) {
    if ("pwd" in memData) return memData;
  }

  const cacheKey = new Request(`http://qbinv1.4/p/${key}`);
  const cacheData = await cache.match(cacheKey);
  if (cacheData) {
    const headers = cacheData.headers;
    const cachedPwd = headers.get("x-pwd") || "";
    const metadata: Metadata = {
      fkey: key,
      time: parseInt(headers.get("x-time") ?? "0"),
      expire: parseInt(headers.get("x-expire") ?? "-1"),
      ip: headers.get("x-ip") ?? "",
      content: await cacheData.arrayBuffer(),
      mime: headers.get("Content-Type") ?? "application/octet-stream",
      len: parseInt(headers.get("Content-Length") ?? "0"),
      pwd: cachedPwd || "",
      email: headers.get("x-email") || "",
      uname: headers.get("x-uname") ?? undefined,
      hash: parseInt(headers.get("x-hash") ?? "0"),
    };
    memCache.set(key, metadata);
    return metadata;
  }

  const kvResult = await kv.get([PASTE_STORE, key]);
  if (!kvResult.value){
    memCache.set(key, {'pwd': "!"});   // 减少内查询
    return null;
  }

  // 解决pg到kv批量同步问题
  if (kvResult.value === true){
    const dbData = await repo.getByFkey(key);
    if (!dbData) return null;
    if (!checkPassword(dbData.pwd, pwd)) return null;
    await updateCache(key, dbData);
    delete dbData.content;
    kvResult.value = dbData;
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

  const cacheKey = new Request(`http://qbinv1.4/p/${key}`);
  const cacheData = await cache.match(cacheKey);
  if (cacheData) {
    const headers = cacheData.headers;
    const cachedPwd = headers.get("x-pwd") || "";
    if (cachedPwd && cachedPwd !== pwd) {
        memCache.set(key, {'pwd': cachedPwd});   // 减少内查询
        return null;
    }
    const metadata: Metadata = {
      fkey: key,
      time: parseInt(headers.get("x-time") ?? "0"),
      expire: parseInt(headers.get("x-expire") ?? "-1"),
      ip: headers.get("x-ip") ?? "",
      content: await cacheData.arrayBuffer(),
      mime: headers.get("Content-Type") ?? "application/octet-stream",
      len: parseInt(headers.get("Content-Length") ?? "0"),
      pwd: cachedPwd || "",
      email: headers.get("x-email") || "",
      uname: headers.get("x-uname") ?? undefined,
      hash: parseInt(headers.get("x-hash") ?? "0"),
    };
    memCache.set(key, metadata);
    return metadata;
  }
  else if(memData && "pwd" in memData){
    return memData;
  }

  const kvResult = await kv.get([PASTE_STORE, key]);
  if (!kvResult.value){
    memCache.set(key, {'pwd': "!"});   // 减少内查询
    return null;
  }
  if (!checkPassword(kvResult.value.pwd, pwd)){
    memCache.set(key, {'pwd': kvResult.value.pwd});   // 减少内查询
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
    if (cache !== true && "content" in cache) return cache;

    const dbData = await repo.getByFkey(key);
    if (!dbData) return null;
    if (!checkPassword(dbData.pwd, pwd)) return null;
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
    const cacheKey = new Request(`http://qbinv1.4/p/${key}`);
    const headers = {
      'Content-Type': metadata.mime,
      'Content-Length': metadata.len,
      'Cache-Control': 'max-age=604800',
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
    memCache.set(key, {'pwd': meta.pwd, expire: meta.expire});
    delete meta.content;
    if (meta.expire > 0) meta.expire = -meta.expire;
    await updateCache(key, meta)
  } catch (error) {
    console.error('Cache deletion error:', error);
  }
}
