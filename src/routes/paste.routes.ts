import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getRaw,
  save,
  remove,
  queryRaw,
} from "../controllers/paste.controller.ts";

const router = new Router();

router
  .get("/r/:key?/:pwd?", getRaw)
  .head("/r/:key?/:pwd?", queryRaw)  // 让 controller 内部自行判断 HEAD / GET
  .post("/s/:key/:pwd?", save)
  .put("/s/:key/:pwd?", save)
  .delete("/d/:key/:pwd?", remove);

export default router;