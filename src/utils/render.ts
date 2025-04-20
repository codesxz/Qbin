/**
 * 模板渲染 / 读取工具
 */
import { join } from "https://deno.land/std/path/mod.ts";
import {basePath} from "../config/constants.ts";
import {fontsTypeMap, imgTypeMap} from "../types.ts";
import { cyrb53_str } from "./common.ts";


export async function getJS(ctx, pathname, status=200): Promise<string> {
  try {
    ctx.response.body = await Deno.readTextFile(join(basePath, `/static/js/${pathname}`));
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "application/javascript");
    // ctx.response.headers.set("Cache-Control", "public, max-age=86400, immutable");
    const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
    ctx.state.metadata = { etag: hash };
  } catch (error) {}
}

export async function getCSS(ctx, pathname, status=200): Promise<string> {
  try {
    ctx.response.body = await Deno.readTextFile(join(basePath, `/static/css/${pathname}`));
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/css");
    // ctx.response.headers.set("Cache-Control", "public, max-age=86400, immutable");
    const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
    ctx.state.metadata = { etag: hash };
  } catch (error) {}
}

export async function getIMG(ctx, pathname, status=200): Promise<string> {
  try {
    const extension = pathname.split('.').pop()?.toLowerCase() || '';
    const contentType = imgTypeMap[extension] || 'application/octet-stream';
    ctx.response.body = await Deno.readFile(join(basePath, `/static/img/${pathname}`));
    ctx.response.status = status;

    ctx.response.headers.set("Content-Type", contentType);
    ctx.response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
    ctx.state.metadata = { etag: hash };
  } catch (error) {}
}

export async function getFONTS(ctx, pathname, status=200): Promise<string> {
  try {
    const extension = pathname.split('.').pop()?.toLowerCase() || '';
    const contentType = fontsTypeMap[extension] || 'application/octet-stream';
    ctx.response.body = await Deno.readFile(join(basePath, `/static/css/fonts/${pathname}`));
    ctx.response.status = status;

    ctx.response.headers.set("Content-Type", contentType);
    ctx.response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
    ctx.state.metadata = { etag: hash };
  } catch (error) {}
}

export async function getRenderHtml(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  // ctx.response.headers.set("Cache-Control", "public, max-age=300");  // public, max-age=3600
  ctx.response.body = await Deno.readTextFile(join(basePath, './templates/render.html'));
  const hash = cyrb53_str('render.html' + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

export async function getEditHtml(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  // ctx.response.headers.set("Cache-Control", "public, max-age=300");
  ctx.response.body = await Deno.readTextFile(join(basePath, './templates/multi-editor.html'));
  const hash = cyrb53_str("multi-editor.html" + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

export async function getCodeEditHtml(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  // ctx.response.headers.set("Cache-Control", "public, max-age=300");
  ctx.response.body = await Deno.readTextFile(join(basePath, './templates/code-editor.html'));
  const hash = cyrb53_str("code-editor.html" + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

export async function getMDEditHtml(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  // ctx.response.headers.set("Cache-Control", "public, max-age=300");
  ctx.response.body = await Deno.readTextFile(join(basePath, './templates/md-editor.html'));
  const hash = cyrb53_str("md-editor.html" + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

export async function getLoginPageHtml(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  // ctx.response.headers.set("Cache-Control", "public, max-age=300");
  ctx.response.body = await Deno.readTextFile(join(basePath, './templates/login.html'));
  const hash = cyrb53_str('login.html' + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

export async function getDocumentHtml(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  // ctx.response.headers.set("Cache-Control", "public, max-age=300");
  ctx.response.body = await Deno.readTextFile(join(basePath, './Docs/document.md'));
  const hash = cyrb53_str("document.md" + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

export async function getFavicon(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "image/svg+xml");
  ctx.response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  ctx.response.body = await Deno.readFile(join(basePath, './static/img/favicon.svg'));
}

export async function getHomeHtml(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  // ctx.response.headers.set("Cache-Control", "public, max-age=300");
  ctx.response.body = await Deno.readTextFile(join(basePath, './templates/home.html'));
  const hash = cyrb53_str("home.html" + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

// PWA - Service Worker
export async function getServiceWorker(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "application/javascript");
  ctx.response.headers.set("Cache-Control", "no-cache, must-revalidate");
  ctx.response.headers.set("Service-Worker-Allowed", "/");
  ctx.response.body = await Deno.readTextFile(join(basePath, './static/js/service-worker.js'));
  const hash = cyrb53_str('service-worker.js' + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

// PWA - Manifest
export async function getManifest(ctx, status=200): Promise<string> {
  ctx.response.status = status;
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.headers.set("Cache-Control", "public, max-age=86400");
  ctx.response.body = await Deno.readTextFile(join(basePath, './static/manifest.json'));
  const hash = cyrb53_str('manifest.json' + ctx.response.body.length);
  ctx.state.metadata = { etag: hash };
}

// // 路径格式错误网页
// export async function getPathErrorHtml(ctx, status=200): Promise<string> {
//   ctx.response.status = status;
//   ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
//   // ctx.response.headers.set("Cache-Control", "public, max-age=300");
//   ctx.response.body = await Deno.readTextFile(join(basePath, './templates/error.html'));
//   const hash = cyrb53_str('error.html' + ctx.response.body.length);
//   ctx.state.metadata = { etag: hash };
// }
//
// // 密码保存内容网页
// export async function getPassWordHtml(ctx, status=200): Promise<string> {
//   ctx.response.status = status;
//   ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
//   // ctx.response.headers.set("Cache-Control", "public, max-age=300");
//   ctx.response.body = await Deno.readTextFile(join(basePath, './templates/password.html'));
//   const hash = cyrb53_str('password.html' + ctx.response.body.length);
//   ctx.state.metadata = { etag: hash };
// }
