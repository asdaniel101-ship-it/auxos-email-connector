FROM node:20-alpine

WORKDIR /app

# Copy API package files (from apps/api directory)
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma/
COPY apps/api/tsconfig*.json ./
COPY apps/api/nest-cli.json ./

# Install dependencies using npm ci approach but without lockfile
# This avoids the "extraneous" npm bug
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --no-package-lock --no-audit --no-fund

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY apps/api/src ./src/

# Build the application
RUN npm run build

# Expose port (Railway will set PORT env var)
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start:prod"]

