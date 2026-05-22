#!/bin/bash
# Start all dev services: web, API, and localtunnel
# Usage: bash scripts/dev.sh

set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Kill any existing processes on our ports
lsof -ti:3000 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -f localtunnel 2>/dev/null || true
sleep 1

echo "Starting API backend..."
(cd "$ROOT/services/api" && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
API_PID=$!

echo "Starting web frontend..."
(cd "$ROOT" && pnpm dev) &
WEB_PID=$!

echo "Starting localtunnel (auto-restart)..."
(
  while true; do
    npx localtunnel --port 8000 --subdomain seven-tables-mix 2>&1 || true
    echo "[tunnel] Restarting in 3s..."
    sleep 3
  done
) &
TUNNEL_PID=$!

echo ""
echo "All services starting:"
echo "  Web:    http://localhost:3000"
echo "  API:    http://localhost:8000"
echo "  Tunnel: https://seven-tables-mix.loca.lt"
echo ""
echo "Press Ctrl+C to stop all."

trap "kill $API_PID $WEB_PID $TUNNEL_PID 2>/dev/null; exit" INT TERM
wait
