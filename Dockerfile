# Stage 1: Install dependencies
FROM node:18-alpine AS deps

WORKDIR /app

# Copy only package files
COPY apps/api/package.json ./

# Install npm@9.9.3 (doesn't have extraneous bug)
RUN npm install -g npm@9.9.3

# Clean install dependencies
RUN npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install --legacy-peer-deps --no-package-lock --loglevel=error

# Stage 2: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma/
COPY apps/api/tsconfig*.json ./
COPY apps/api/nest-cli.json ./

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY apps/api/src ./src/

# Build
RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS runner

WORKDIR /app

# Copy built app and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client for production
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "start:prod"]

