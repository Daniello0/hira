FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/core-api/package.json apps/core-api/package.json
COPY apps/retrieval-service/package.json apps/retrieval-service/package.json
COPY apps/llm-service/package.json apps/llm-service/package.json
COPY apps/ingestion-service/package.json apps/ingestion-service/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY packages/contracts packages/contracts
COPY apps/core-api apps/core-api
COPY apps/retrieval-service apps/retrieval-service
COPY apps/llm-service apps/llm-service
COPY apps/ingestion-service apps/ingestion-service

ARG WORKSPACE
RUN npm run build -w @hira/contracts && npm run build -w "${WORKSPACE}"

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

ARG APP_DIR
ARG START_COMMAND
COPY --from=build /app /app
WORKDIR ${APP_DIR}
ENV START_COMMAND=${START_COMMAND}

CMD ["sh", "-c", "$START_COMMAND"]
