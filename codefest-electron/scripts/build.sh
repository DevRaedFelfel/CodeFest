#!/bin/bash
# CodeFest Electron — Build Script
# Usage: ./scripts/build.sh [--bundle-angular]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLIENT_DIR="$(dirname "$PROJECT_DIR")/codefest-client"

cd "$PROJECT_DIR"

echo "=== CodeFest Electron Build ==="

# Step 1: Compile TypeScript
echo "[1/3] Compiling TypeScript..."
npx tsc

# Step 2: Optionally bundle Angular
if [ "$1" = "--bundle-angular" ]; then
  echo "[2/3] Building Angular and bundling into Electron..."

  if [ ! -d "$CLIENT_DIR" ]; then
    echo "Error: Angular project not found at $CLIENT_DIR"
    exit 1
  fi

  cd "$CLIENT_DIR"
  npx ng build --configuration production

  cd "$PROJECT_DIR"
  mkdir -p src/renderer
  cp -r "$CLIENT_DIR/dist/codefest-client/browser/"* src/renderer/

  echo "  Angular bundled into src/renderer/"
else
  echo "[2/3] Skipping Angular bundle (will load from remote server)"
fi

# Step 3: Build installer
echo "[3/3] Building Windows installer..."
npx electron-builder --win

echo ""
echo "=== Build Complete ==="
echo "Installer: installer/CodeFest Exam Setup $(node -p "require('./package.json').version").exe"
