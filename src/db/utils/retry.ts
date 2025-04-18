import {get_env} from "../../config/env.ts";

/**
 * 数据库调用重试包装
 *  – 指数退避：baseDelay * 2^(n‑1)（附带 0‑50ms 随机抖动）
 *  – 默认最多重试 3 次，可用环境变量 DB_MAX_RETRY / DB_BASE_DELAY 覆盖
 *  – 仅对“可恢复/瞬时”错误重试
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retry = Number(get_env("DB_MAX_RETRY") ?? 3),
  baseDelay = Number(get_env("DB_BASE_DELAY") ?? 100),
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retry || !isTransient(err)) throw err;
      const delay = baseDelay * 2 ** (attempt - 1) + Math.random() * 50;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function isTransient(e: any): boolean {
  if (e?.code && typeof e.code === "string") {
    return [
      "ECONNRESET",
      "ECONNREFUSED",
      "EPIPE",
      "ETIMEDOUT",
      "PROTOCOL_CONNECTION_LOST",
      "57P01", // admin_shutdown
      "57P02", // crash_shutdown
      "57P03", // cannot_connect_now
      "53300", // too_many_connections
    ].includes(e.code);
  }
  const msg = String(e?.message ?? "");
  return /(timeout|terminat|reset|refused|too many)/i.test(msg);
}