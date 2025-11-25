FROM node:18-alpine

WORKDIR /app

# Copy API package files (from apps/api directory)
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma/
COPY apps/api/tsconfig*.json ./
COPY apps/api/nest-cli.json ./

# Install specific npm version that doesn't have the extraneous bug
RUN npm install -g npm@9.9.3

# Install dependencies - use npm@9 which doesn't have the extraneous bug
RUN npm cache clean --force && \
    npm install --legacy-peer-deps --no-package-lock

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

