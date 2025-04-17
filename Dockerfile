FROM denoland/deno:2.2.10

EXPOSE 8000
WORKDIR /app
ENV QBIN_DIR=/qbin-dir
COPY . .

RUN chown -R deno:deno /app && \
    mkdir -p ${QBIN_DIR} && \
    chown -R deno:deno ${QBIN_DIR}

USER deno
RUN deno cache index.ts
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--unstable-kv", "--unstable-broadcast-channel", "index.ts"]