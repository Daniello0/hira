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
COPY apps/web apps/web

ARG NEXT_PUBLIC_CORE_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_CORE_API_URL=${NEXT_PUBLIC_CORE_API_URL}

RUN npm run build -w @hira/contracts && npm run build -w @hira/web

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
