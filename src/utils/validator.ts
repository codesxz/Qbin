import { VALID_CHARS_REGEX } from "../config/constants.ts";
import { PasteError } from "./response.ts";
import { ResponseMessages } from "./messages.ts";
import {generateKey} from "./common.ts";

/** 解析 /:key/:pwd? 并完成合法性校验 */
export function parsePathParams(
  params: Record<string, string | undefined>,
): { key: string; pwd: string } {
  const key = params.key;
  const pwd = params.pwd;

  if (
    key && (key.length > 32 || key.length < 2 || !VALID_CHARS_REGEX.test(key))
  ) throw new PasteError(403, ResponseMessages.PATH_UNAVAILABLE);

  if (
    pwd && (pwd.length > 32 || pwd.length < 1 || !VALID_CHARS_REGEX.test(pwd))
  ) throw new PasteError(403, ResponseMessages.PATH_UNAVAILABLE);

  return {
    key: key ?? generateKey(),
    pwd: pwd ?? "",
  };
}

/** 通用分页校验 */
export function parsePagination(url: URL): { page: number; pageSize: number } {
  const page = +(url.searchParams.get("page") ?? "1");
  const pageSize = +(url.searchParams.get("pageSize") ?? "10");
  if (!Number.isInteger(page) || page < 1) {
    throw new PasteError(400, ResponseMessages.INVALID_PAGE);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new PasteError(400, ResponseMessages.INVALID_PAGE_SIZE);
  }
  return { page, pageSize };
}