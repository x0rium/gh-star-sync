# Stage 1: Build
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy prisma schema
COPY prisma ./prisma

# Generate prisma client
RUN pnpm prisma generate

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine

# Install pnpm for running scripts
RUN npm install -g pnpm

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose application port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Run migrations and start the application
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]