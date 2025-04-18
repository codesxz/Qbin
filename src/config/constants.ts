/**
 * 全局常量配置
 */
import {get_env} from "./env.ts";


export const TOKEN_EXPIRE = parseInt(get_env("TOKEN_EXPIRE") || "31536000"); // JWT 过期时长(秒)
export const MAX_UPLOAD_FILE_SIZE = parseInt(get_env("MAX_UPLOAD_FILE_SIZE") || "52428800");  // 5MB

export const PASTE_STORE = "qbin";     // KV 命名空间
export const CACHE_CHANNEL = "qbin-cache-sync";

export const jwtSecret = get_env("JWT_SECRET") || "input-your-jwtSecret";  // 从环境变量获取jwt密钥
export const exactPaths = ["/favicon.ico", "/document", "/health", "/login", "/service-worker.js", "/manifest.json"]
export const prefixPaths = ['/r/', '/p/', '/static/', '/api/login/']
export const basePath = Deno.cwd();

// 分布式缓存唯一标识
// export const instanceId = `${get_env("DENO_DEPLOYMENT_ID")}-${get_env("DENO_REGION")}-${crypto.randomUUID()}`;
export const EMAIL = get_env("ADMIN_EMAIL") || "admin@qbin.github";
export const PASSWORD = get_env("ADMIN_PASSWORD") || "qbin";
export const ISDEMO = get_env("ISDEMO") || false;
// 匹配可用字符
export const VALID_CHARS_REGEX = /^[a-zA-Z0-9-\.\_]+$/;
// MIME 类型校验正则
export const mimeTypeRegex = /^[-\w.+]+\/[-\w.+]+(?:;\s*[-\w]+=[-\w]+)*$/i;
// 保留访问路径
export const reservedPaths = new Set<string>(
    (get_env("RESERVED_PATHS") || "").split(",").map(s => s.trim().toLowerCase())
);

export const HEADERS = {
  HTML: {
    "X-Content-Type-Options": "nosniff",    // 禁止嗅探MIME类型
    "X-XSS-Protection": "1; mode=block",    // 启用XSS过滤器
    "X-Frame-Options": "DENY",              // 禁止页面在frame中展示
    // "Content-Security-Policy": "default-src 'self'",  // 同源加载
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",  // HSTS强制使用HTTPS
    "Referrer-Policy": "strict-origin-when-cross-origin",      // 引用策略
  },
  JSON: { "Content-Type": "application/json" },
  CORS: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
};
