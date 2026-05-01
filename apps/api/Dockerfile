# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Install all workspace deps
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy API source and build
COPY apps/api ./apps/api
RUN pnpm --filter @loraloop/api exec prisma generate
RUN pnpm --filter @loraloop/api build

# ── Stage 2: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Production-only install
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy compiled output
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma 2>/dev/null || true

EXPOSE 3000

WORKDIR /app/apps/api

CMD ["node", "dist/main"]
