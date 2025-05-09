# ──────── build stage ─────────────────────
FROM denoland/deno:2.3.1 AS build

ARG DB_CLIENT=sqlite
ENV DB_CLIENT=${DB_CLIENT}
ENV SQLITE_URL="file:/app/data/qbin_local.db"

WORKDIR /app
COPY . .

RUN mkdir -p node_modules/.deno && \
    chown -R deno:deno /app

# 预先缓存依赖
RUN deno cache index.ts

# 执行sqlite数据库初始化任务
RUN mkdir -p data/ && \
    chown -R deno:deno data/ && \
    sed -i -e 's/"deno"/"no-deno"/' node_modules/@libsql/client/package.json && \
    deno task db:generate && \
    deno task db:migrate  && \
    deno task db:push     && \
    sed -i -e 's/"no-deno"/"deno"/' node_modules/@libsql/client/package.json

# ──────── runtime stage ───────────────────
FROM denoland/deno:2.3.1

# 安装 curl
RUN apt-get update && apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV DB_CLIENT=sqlite
ENV SQLITE_URL="file:/app/data/qbin_local.db"

# 把种子文件存到 /app/seed
COPY --from=build /app/data/qbin_local.db /app/seed/qbin_local.db
COPY --from=build /app /app

# 入口脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
