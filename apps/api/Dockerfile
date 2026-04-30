# ─────────────────────────────────────────────────
# Stage: development
# ─────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

RUN pnpm install

COPY . .

RUN pnpm exec prisma generate

EXPOSE 3000

CMD ["pnpm", "dev"]

# ─────────────────────────────────────────────────
# Stage: build
# ─────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate
RUN pnpm build
RUN pnpm prune --prod

# ─────────────────────────────────────────────────
# Stage: production
# ─────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/main"]
