#!/bin/sh
set -e

# 修正挂载目录权限
mkdir -p /app/data
chown -R deno:deno /app/data

# 第一次启动时复制种子数据库
if [ ! -f /app/data/qbin_local.db ]; then
  echo "数据库文件不存在，正在从初始化备份中复制..."
  cp /app/seed/qbin_local.db /app/data/qbin_local.db
  chown deno:deno /app/data/qbin_local.db
  echo "数据库初始化完成!"
fi

cd /app
exec deno run -NER --allow-ffi --allow-sys --unstable-kv --unstable-broadcast-channel index.ts "$@"
