import { Router } from "https://deno.land/x/oak/mod.ts";
import { handleAdminLogin, handleLogin, handleOAuthCallback } from "../middlewares/auth.ts";
import {getStorage, getToken} from "../controllers/user.controller.ts";
import { Response } from "../utils/response.ts";
import { ResponseMessages } from "../utils/messages.ts";

const router = new Router();

router
  .post("/api/login/admin", handleAdminLogin)
  .get("/api/login/:provider", handleLogin)
  .get("/api/login/oauth2/callback/:provider", handleOAuthCallback)
  .post("/api/user/logout", async (ctx) => {
    await ctx.cookies.delete("token", { path: "/", httpOnly: true, sameSite: "strict" });
    return new Response(ctx, 200, ResponseMessages.LOGGED_OUT);
  })
  .get("/api/user/info", async (ctx) => {
    const data = await ctx.state.session?.get("user");
    return new Response(ctx, 200, ResponseMessages.SUCCESS, data);
  })
  .post("/api/user/token", getToken)
  .get("/api/user/storage", getStorage)
  .get("/api/health", (ctx) => ctx.response.body = "healthy");
  // .post("/api/user/shares", async (ctx) => {
  //   return new Response(ctx, 200, ResponseMessages.SUCCESS, [{ }]);
  // })

export default router;