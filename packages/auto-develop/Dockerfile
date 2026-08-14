FROM node:26-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git tmux \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://vite.plus | bash
ENV PATH="/root/.vite-plus/bin:$PATH"
RUN vp install --global --node 26.7.0 @anthropic-ai/claude-code@2.1.228
ENV DISABLE_AUTOUPDATER=1

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/website/package.json apps/website/
COPY packages/agentic-documents/package.json packages/agentic-documents/
COPY packages/ai-native/package.json packages/ai-native/
COPY packages/auto-develop/package.json packages/auto-develop/
COPY packages/dont-review-it/package.json packages/dont-review-it/
COPY packages/lint-rule-authoring/package.json packages/lint-rule-authoring/
COPY packages/repository-checks/package.json packages/repository-checks/
COPY packages/stop-ai-slop/package.json packages/stop-ai-slop/
COPY packages/verified-specifications/package.json packages/verified-specifications/
RUN vp install --ignore-scripts --frozen-lockfile --filter @mst/auto-develop...

COPY . .

ENV AUTO_DEVELOP_LOG_DIR=/var/log/auto-develop
RUN mkdir -p "$AUTO_DEVELOP_LOG_DIR"

VOLUME ["/repository", "/var/log/auto-develop"]
WORKDIR /repository

ENTRYPOINT ["node", "/app/packages/auto-develop/src/cli.ts"]
CMD ["reviewer"]
