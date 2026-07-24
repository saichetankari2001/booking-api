# Stage 1: builder
FROM node:20-alpine AS builder
WORKDIR /app
# Alpine 3.18+ ships OpenSSL 3.x only, and its musl images don't include the
# openssl CLI/libs by default. Without it, Prisma's engine-detection can't
# read the installed OpenSSL version and falls back to assuming 1.1.x, which
# doesn't exist here and crashes engine loading. Installing openssl lets
# Prisma detect OpenSSL 3.x correctly (paired with the explicit
# linux-musl-openssl-3.0.x binaryTarget in prisma/schema.prisma).
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# Stage 2: production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# See builder stage comment: required for Prisma to correctly detect
# OpenSSL 3.x at runtime instead of defaulting to the missing 1.1.x engine.
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
