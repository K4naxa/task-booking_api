# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Set DATABASE_URL for Prisma generation (placeholder for build)
ENV DATABASE_URL="file:./dev.db"

# Copy package files and prisma configuration
COPY package*.json ./
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Copy prisma directory
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY nest-cli.json ./

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Set DATABASE_URL environment variable
ENV DATABASE_URL="file:./dev.db"

# Copy package files and prisma configuration
COPY package*.json ./
COPY prisma.config.ts ./

# Copy prisma directory (needed for migrations and seeding)
COPY prisma ./prisma/

# Install production dependencies AND tsx for seeding
RUN npm ci --omit=dev && npm install tsx

# Copy Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Run migrations, seed database, and start application
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main.js"]
