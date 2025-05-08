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
RUN sed -i -e 's/"deno"/"no-deno"/' node_modules/@libsql/client/package.json && \
    deno task db:generate && \
    deno task db:migrate  && \
    deno task db:push     && \
    sed -i -e 's/"no-deno"/"deno"/' node_modules/@libsql/client/package.json

# ──────── runtime stage ───────────────────
FROM denoland/deno:2.3.1

ENV DB_CLIENT=sqlite
ENV SQLITE_URL="file:/app/data/qbin_local.db"

WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /app/data && chown -R deno:deno /app

USER deno
WORKDIR /app

EXPOSE 8000
CMD ["run", "-NER", "--allow-ffi", "--allow-sys", "--unstable-kv", "--unstable-broadcast-channel", "index.ts"]