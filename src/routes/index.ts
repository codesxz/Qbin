import { Router } from "https://deno.land/x/oak/mod.ts";
import frontend from "./frontend.routes.ts";
import paste from "./paste.routes.ts";
import api from "./api.routes.ts";
import admin from "./admin.routes.ts";

const router = new Router();

router
  .use(frontend.routes(), frontend.allowedMethods())
  .use(paste.routes(), paste.allowedMethods())
  .use(api.routes(), api.allowedMethods())
  .use(admin.routes(), api.allowedMethods())

export default router;