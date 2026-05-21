#!/usr/bin/env bash
# Expose local FastAPI (port 8000) for Path A testing (Vercel + Recall webhooks).
# Usage: ./scripts/start-api-tunnel.sh
# Requires: API running (pnpm dev), Node.js for localtunnel.

set -euo pipefail

PORT="${API_TUNNEL_PORT:-8000}"

if ! curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "ERROR: API not running on http://127.0.0.1:${PORT}/health"
  echo "Start from repo root: pnpm dev"
  exit 1
fi

echo "Starting localtunnel on port ${PORT}..."
echo "(For ngrok instead: ngrok config add-authtoken YOUR_TOKEN && ngrok http ${PORT})"
echo ""

npx --yes localtunnel --port "${PORT}" 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" =~ https://[a-z0-9.-]+\.loca\.lt ]]; then
    url=$(echo "$line" | grep -oE 'https://[a-z0-9.-]+\.loca\.lt' | head -1)
    echo ""
    echo "=== Path A — paste into services/api/.env and apps/web/.env.local ==="
    echo "PUBLIC_API_BASE_URL=${url}"
    echo "API_URL=${url}"
    echo "NEXT_PUBLIC_API_URL=${url}"
    echo "INTERNAL_API_URL=${url}"
    echo "NEXT_PUBLIC_WS_URL=wss://${url#https://}"
    echo ""
    echo "Health: ${url}/health"
    echo "Then restart: pnpm dev"
  fi
done
