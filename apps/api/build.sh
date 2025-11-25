#!/bin/bash
set -e

echo "=== API Build Script ==="
echo "Forcing npm usage, ignoring pnpm..."

# Explicitly use npm
export npm_config_user_agent="npm"

# Install with npm
echo "Installing dependencies with npm..."
npm install --legacy-peer-deps

# Generate Prisma
echo "Generating Prisma client..."
npx prisma generate

# Build
echo "Building NestJS application..."
npm run build

echo "=== Build Complete ==="

