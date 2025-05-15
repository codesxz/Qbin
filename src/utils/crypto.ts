import { create, verify, getNumericDate, decode } from "https://deno.land/x/djwt/mod.ts";
import { jwtSecret } from "../config/constants.ts";


/**
 * Web Crypto API 导入 Key
 */
export const JWT_KEY = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(jwtSecret),
  { name: "HMAC", hash: "SHA-256" }, // "SHA-512"
  true,
  ["sign", "verify"],
);

/**
 * 生成 JWT，并设置过期时间
 */
export async function generateJwtToken(payload: Record<string, unknown>, exp): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const claims = {
    ...payload,
    exp: getNumericDate(exp),
  };
  return await create(header, claims, JWT_KEY);
}

/**
 * 验证 JWT，如果成功返回其 payload，失败则抛出异常。
 */
export async function verifyJwtToken(jwt: string) {
  return await verify(jwt, JWT_KEY, { alg: "HS256" });
}

export function decodeJwtToken(token: string) {
  // decode 只解析 token 而不验证签名或过期时间
  const [header, payload] = decode(token);
  return { header, payload };
}