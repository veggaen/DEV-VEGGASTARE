# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src

# Copy dependency manifests first (Docker layer cache: only re-install when deps change)
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci

# Copy source + build
COPY . .
RUN npm run build && node --test tests/security.test.cjs

# ── Stage 2: Production (slim) ──────────────────────────────
FROM node:22-bookworm-slim AS runner

RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src
ENV NODE_ENV=production

# Copy only production deps
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm ci --omit=dev

# Copy built output + generated Prisma client from builder
COPY --from=builder /usr/src/dist ./dist
COPY --from=builder /usr/src/prisma ./prisma
COPY --from=builder /usr/src/prisma.config.ts ./prisma.config.ts

EXPOSE 3001
EXPOSE 3002

USER node
CMD ["node", "dist/index.js"]
