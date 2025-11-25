FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm cache clean --force && npm install --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src/

# Build the application
RUN npm run build

# Expose port (Railway will set PORT env var)
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start:prod"]

