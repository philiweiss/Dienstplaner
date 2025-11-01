#!/usr/bin/env bash
set -euo pipefail

# Deploy script for Dienstplaner (frontend + backend)
# - Builds frontend with Vite
# - Syncs SPA build to server/public (Express static)
# - Builds backend (TypeScript -> dist)
# - Restarts Passenger app by touching tmp/restart.txt
#
# Usage:
#   npm run deploy:prod
# or
#   bash scripts/deploy.sh
#
# Optional env:
#   HEALTH_URL=https://dev.wproducts.de/api/health   # to verify after deploy

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
PUBLIC_DIR="$SERVER_DIR/public"
DIST_DIR="$ROOT_DIR/dist"

log() { echo -e "\033[1;34m[deploy]\033[0m $*"; }
fail() { echo -e "\033[1;31m[deploy]\033[0m $*" >&2; exit 1; }

log "Repo root: $ROOT_DIR"
log "Server dir: $SERVER_DIR"

# 1) Build frontend (Vite)
log "Building frontend (Vite)..."
cd "$ROOT_DIR"
if command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
  npm run build
else
  fail "npm not found in PATH"
fi

# Check build output exists
if [ ! -f "$DIST_DIR/index.html" ]; then
  fail "dist/index.html was not produced. Check your index.html entry script (e.g., <script type=\"module\" src=\"/index.tsx\">)."
fi

# If assets directory is missing, warn (can happen with minimal HTML-only build)
if [ ! -d "$DIST_DIR/assets" ]; then
  log "WARNING: dist/assets/ not found. Ensure your index.html references a module entry (e.g., /index.tsx) so Vite emits bundles. Proceeding to copy dist/ anyway."
fi

# 2) Sync SPA to server/public
log "Syncing frontend build to server/public (rsync --delete)..."
mkdir -p "$PUBLIC_DIR"
rsync -a --delete "$DIST_DIR/" "$PUBLIC_DIR/"

# 3) Build backend
log "Building backend (TypeScript -> dist)..."
cd "$SERVER_DIR"
if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi
npm run build

# 4) Restart Passenger app
log "Restarting Passenger app..."
mkdir -p "$SERVER_DIR/tmp"
touch "$SERVER_DIR/tmp/restart.txt"

# 5) Optional health check
if [ -n "${HEALTH_URL:-}" ]; then
  log "Checking health: $HEALTH_URL"
  if command -v curl >/dev/null 2>&1; then
    set +e
    curl -sS "$HEALTH_URL" || true
    set -e
  else
    log "curl not found; skipping health check"
  fi
fi

log "Deploy completed successfully."