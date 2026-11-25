# syntax=docker/dockerfile:1
# SHAHOO self-hosted production image: Node 22 + Nitro node-server.

FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

COPY app.config.ts vite.config.ts tsconfig.json eslint.config.mjs ./
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/
COPY src/ ./src/

ENV NODE_ENV=production
ENV CI=true
ENV NITRO_PRESET=node-server
RUN npm run build:self-hosted
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl dumb-init \
  && addgroup --system --gid 1001 shahoogroup \
  && adduser --system --uid 1001 --ingroup shahoogroup shahoouser \
  && mkdir -p /app/storage/media \
  && chown -R shahoouser:shahoogroup /app/storage

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_PRESET=node-server

COPY --from=builder --chown=shahoouser:shahoogroup /app/.output ./.output
COPY --from=builder --chown=shahoouser:shahoogroup /app/node_modules ./node_modules
COPY --from=builder --chown=shahoouser:shahoogroup /app/package.json ./package.json
COPY --from=builder --chown=shahoouser:shahoogroup /app/scripts ./scripts
COPY --from=builder --chown=shahoouser:shahoogroup /app/migrations ./migrations
# The scheduled worker imports application TypeScript modules directly.
COPY --from=builder --chown=shahoouser:shahoogroup /app/src ./src
COPY --from=builder --chown=shahoouser:shahoogroup /app/tsconfig.json ./tsconfig.json

USER shahoouser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:3000/api/health?type=ready" >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", ".output/server/index.mjs"]
