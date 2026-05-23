#!/usr/bin/env bash
# End-to-end: API + web (auth bypass) + Playwright DOM assertions for live call cockpit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-4008}"
API_BASE="http://127.0.0.1:${API_PORT}"
WEB_BASE="http://localhost:${WEB_PORT}"

api_pid=""
web_pid=""

cleanup() {
  [[ -n "${api_pid}" ]] && kill "${api_pid}" 2>/dev/null || true
  [[ -n "${web_pid}" ]] && kill "${web_pid}" 2>/dev/null || true
}
trap cleanup EXIT

wait_http() {
  local url="$1"
  local label="$2"
  local i
  for i in $(seq 1 60); do
    if curl -sf "${url}" >/dev/null 2>&1; then
      echo "✓ ${label} ready (${url})"
      return 0
    fi
    sleep 1
  done
  echo "✗ ${label} did not become ready: ${url}" >&2
  return 1
}

if ! curl -sf "${API_BASE}/health" >/dev/null 2>&1; then
  echo "Starting API on :${API_PORT}…"
  (
    cd "${ROOT}/services/api"
    export DEMO_TRANSCRIPT_REPLAY=true
    PYTHONPATH="${ROOT}/python-packages:${ROOT}/services/api" \
      python3 -m uvicorn app.main:app --host 127.0.0.1 --port "${API_PORT}" \
      >> /tmp/dc-api-e2e.log 2>&1
  ) &
  api_pid=$!
  wait_http "${API_BASE}/health" "API"
else
  echo "✓ API already running"
fi

if ! curl -sf "${WEB_BASE}/" -o /dev/null 2>&1; then
  echo "Starting web on :${WEB_PORT} (auth bypass)…"
  (
    cd "${ROOT}/apps/web"
    export PORT="${WEB_PORT}"
    export NEXT_PUBLIC_AUTH_BYPASS=true
    export NEXT_PUBLIC_WS_URL="ws://127.0.0.1:${API_PORT}"
    export NEXT_PUBLIC_ENABLE_DEMO_TRANSCRIPT=true
    export API_URL="${API_BASE}"
    pnpm exec next dev --port "${WEB_PORT}" >> /tmp/dc-web-e2e.log 2>&1
  ) &
  web_pid=$!
  wait_http "${WEB_BASE}/" "Web"
else
  echo "✓ Web already running (ensure NEXT_PUBLIC_AUTH_BYPASS=true for unauthenticated e2e)"
fi

cd "${ROOT}/apps/web"
export PLAYWRIGHT_BASE_URL="${WEB_BASE}"
export PLAYWRIGHT_API_URL="${API_BASE}"
export NEXT_PUBLIC_AUTH_BYPASS=true
export NEXT_PUBLIC_WS_URL="ws://127.0.0.1:${API_PORT}"

echo ""
echo "Running Playwright live-call DOM test…"
pnpm exec playwright test e2e/live-call-dom.spec.ts --reporter=list

echo ""
echo "Done — live call DOM test passed."
