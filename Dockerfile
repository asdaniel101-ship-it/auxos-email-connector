FROM node:20-alpine

# Install yarn
RUN npm install -g yarn

WORKDIR /app

# Copy API package files (from apps/api directory)
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma/
COPY apps/api/tsconfig*.json ./
COPY apps/api/nest-cli.json ./

# Install dependencies using yarn (avoids npm extraneous bug)
RUN yarn install --frozen-lockfile --network-timeout 100000 || \
    yarn install --network-timeout 100000

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY apps/api/src ./src/

# Build the application
RUN yarn build

# Expose port (Railway will set PORT env var)
EXPOSE 4000

# Start the application
CMD ["yarn", "start:prod"]

