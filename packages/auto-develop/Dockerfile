FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git tmux \
  && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /workspace

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/auto-develop/package.json packages/auto-develop/
RUN pnpm install --frozen-lockfile --filter @mst/auto-develop...

COPY . .

ENV AUTO_DEVELOP_LOG_DIR=/var/log/auto-develop
RUN mkdir -p "$AUTO_DEVELOP_LOG_DIR"

ENTRYPOINT ["node", "packages/auto-develop/src/cli.ts"]
CMD ["reviewer"]
