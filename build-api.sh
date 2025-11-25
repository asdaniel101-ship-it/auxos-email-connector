#!/bin/bash
set -e

echo "=== Starting API Build ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
  echo "pnpm not found, installing..."
  npm install -g pnpm@9.15.0
fi

echo "pnpm version: $(pnpm --version)"

# Install dependencies
echo "Installing dependencies..."
pnpm install --no-frozen-lockfile || {
  echo "pnpm install failed, trying with --legacy-peer-deps equivalent..."
  pnpm install --no-frozen-lockfile --shamefully-hoist || exit 1
}

# Build API
echo "Building API..."
pnpm --filter api build || {
  echo "Build failed, checking if dist exists..."
  ls -la apps/api/dist || exit 1
  exit 1
}

echo "=== Build Complete ==="

