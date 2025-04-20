import {AppState} from "../types.ts";
import {kv} from "../utils/cache.ts";
import {EMAIL, ISDEMO, PASTE_STORE} from "../config/constants.ts";
import {Response} from "../utils/response.ts";
import {ResponseMessages} from "../utils/messages.ts";
import {parsePagination} from "../utils/validator.ts";
import {createMetadataRepository} from "../db/repositories/metadataRepository.ts";

export async function syncDBToKV(ctx: Context<AppState>, repo) {
  try {
    // 从数据库获取所有fkeys
    const pgFkeys = await repo.getAllFkeys();
    const pgFkeysSet = new Set(pgFkeys);

    // 追踪同步统计信息
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    // 处理现有KV条目
    const kvEntries = kv.list({ prefix: [PASTE_STORE] });
    const kvFkeysSet = new Set<string>();
    const toRemove = [];

    // 识别需要删除的fkeys（存在于KV中但不在数据库中）
    for await (const entry of kvEntries) {
      const fkey = entry.key[1] as string;

      if (!pgFkeysSet.has(fkey)) {
        toRemove.push(["qbin", fkey]);
      } else {
        kvFkeysSet.add(fkey);
        unchanged++;
      }
    }

    // 批量删除过期的fkeys
    const batchSize = 100; // 根据系统限制优化批次大小
    for (let i = 0; i < toRemove.length; i += batchSize) {
      const batch = toRemove.slice(i, i + batchSize);
      if (batch.length > 0) {
        const atomicOp = kv.atomic();
        for (const key of batch) {
          atomicOp.delete(key);
        }
        await atomicOp.commit();
        removed += batch.length;
      }
    }

    // 识别需要添加的fkeys（存在于数据库但不在KV中）
    const toAdd = [];
    for (const fkey of pgFkeys) {
      if (!kvFkeysSet.has(fkey)) {
        toAdd.push(fkey);
      }
    }

    // 批量添加新fkeys
    for (let i = 0; i < toAdd.length; i += batchSize) {
      const batch = toAdd.slice(i, i + batchSize);
      if (batch.length > 0) {
        const atomicOp = kv.atomic();
        for (const fkey of batch) {
          atomicOp.set(["qbin", fkey], true);
        }
        await atomicOp.commit();
        added += batch.length;
      }
    }

    return new Response(ctx, 200, ResponseMessages.SUCCESS, {
      stats: {
        added, // 新增的fkey数量
        removed, // 移除的fkey数量
        unchanged, // 保持不变的fkey数量
        total: pgFkeys.length // 总fkey数量
      }});
  } catch (error) {
    console.error("同步数据库到KV时出错:", error);
    return new Response(ctx, 500, ResponseMessages.SERVER_ERROR)
  }
}

export async function getAllStorage(ctx) {
  if(ISDEMO) return new Response(ctx, 403, ResponseMessages.DEMO_RESTRICTED);
  const email = await ctx.state.session?.get("user")?.email;
  if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);

  const { page, pageSize } = parsePagination(new URL(ctx.request.url));
  const offset = (page - 1) * pageSize;

  const repo = await createMetadataRepository();
  const { items, total } = await repo.listAlive(pageSize, offset);
  const totalPages = Math.ceil(total / pageSize);

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    items,
    pagination: { total, page, pageSize, totalPages },
  });
}
