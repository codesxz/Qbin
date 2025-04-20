import { Router } from "https://deno.land/x/oak/mod.ts";
import {
    getEditHtml,
    getCodeEditHtml,
    getMDEditHtml,
    getFavicon,
    getLoginPageHtml,
    getHomeHtml,
    getRenderHtml,
    getDocumentHtml,
    getServiceWorker,
    getManifest,
    getJS,
    getCSS,
    getFONTS,
    getIMG,
} from "../utils/render.ts";

const router = new Router();

router
  .get("/favicon.ico", (ctx) => getFavicon(ctx, 200))
  .get("/login", (ctx) => getLoginPageHtml(ctx, 200))
  .get("/home", (ctx) => getHomeHtml(ctx, 200))
  .get("/e/:key?/:pwd?", (ctx) => getEditHtml(ctx, 200))
  .get("/c/:key?/:pwd?", (ctx) => getCodeEditHtml(ctx, 200))
  .get("/m/:key?/:pwd?", (ctx) => getMDEditHtml(ctx, 200))
  .get("/p/:key?/:pwd?", async (ctx) => await getRenderHtml(ctx, 200))
  .get(/^\/?[a-zA-Z0-9]?\/?$/, async (ctx) => {
    const editor = await ctx.cookies.get("qbin-editor") ?? "m";
    const map = { e: getEditHtml, c: getCodeEditHtml, m: getMDEditHtml };
    return await (map[editor] ?? getMDEditHtml)(ctx, 200);
  })
  .get("/service-worker.js", (ctx) => getServiceWorker(ctx, 200))
  .get("/manifest.json", (ctx) => getManifest(ctx, 200))
  .get("/document", async (ctx) => {
    return await getDocumentHtml(ctx, 200);
  })
  .get("/static/js/:file", (ctx) => getJS(ctx, ctx.params.file, 200))
  .get("/static/css/:file", (ctx) => getCSS(ctx, ctx.params.file, 200))
  .get("/static/css/fonts/:file", (ctx) => getFONTS(ctx, ctx.params.file, 200))
  .get("/static/img/:file", (ctx) => getIMG(ctx, ctx.params.file, 200));

export default router;