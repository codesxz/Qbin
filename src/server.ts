import { Application } from "https://deno.land/x/oak/mod.ts";
import { AppState } from "./types.ts";
import router from "./routes/index.ts";
import { errorMiddleware } from "./middlewares/error.ts";
import { authMiddleware } from "./middlewares/auth.ts";
import { etagMiddleware } from "./middlewares/etag.ts";
import { loggerMiddleware } from "./middlewares/logger.ts";

/**
 * 创建并配置应用服务器
 * @returns 配置好的Application实例
 */
export function createServer(): Application<AppState> {
  const app = new Application<AppState>({
    state: {
      session: new Map<string, object>()
    },
  });

  // 使用中间件
  app.use(errorMiddleware);
  app.use(etagMiddleware);
  app.use(authMiddleware);
  app.use(loggerMiddleware);
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}