#!/usr/bin/env bash
# Sync services/api/.env to Railway @dc-copilot/api and redeploy.
# Prereq: npm i -g @railway/cli && railway login
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/services/api/.env"

if ! command -v railway >/dev/null 2>&1; then
  echo "Install Railway CLI: npm install -g @railway/cli"
  echo "Then: railway login"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

echo "=== Railway setup for @dc-copilot/api ==="
echo ""
echo "In Railway dashboard (required once if API crashed):"
echo "  1. Open service @dc-copilot/api → Settings"
echo "  2. Root Directory: / (repo root — NOT services/api)"
echo "  3. Dockerfile Path: Dockerfile.api"
echo "  4. Delete @dc-copilot/web (web stays on Vercel)"
echo ""
read -r -p "Press Enter after fixing Root Directory + Dockerfile in Railway UI..."

cd "$REPO_ROOT"

# Link project if needed
if [[ ! -f .railway/config.json ]] 2>/dev/null; then
  echo "Linking Railway project (select talented-smile / @dc-copilot/api)..."
  railway link
fi

echo "Setting variables from services/api/.env ..."
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" || "$line" != *=* ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in
    SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|INTERNAL_SECRET|OPENAI_API_KEY|ANTHROPIC_API_KEY|\
    KB_STORAGE_BUCKET|KB_SHARED_MODE|KB_SHARED_TENANT_KEY|KB_INGEST_SYNC|KB_MAX_UPLOAD_BYTES|\
    KB_EMBEDDING_MODEL|PUBLIC_API_BASE_URL|CORS_ALLOWED_ORIGINS|RECALL_API_KEY|RECALL_REGION|\
    RECALL_BOT_NAME|RECALL_WEBHOOK_SECRET|DEMO_TRANSCRIPT_REPLAY|CONTENT_*|KB_*)
      railway variables set "${key}=${value}" 2>/dev/null || railway variables --set "${key}=${value}"
      echo "  set $key"
      ;;
  esac
done < "$ENV_FILE"

# Production defaults if missing from .env
railway variables set "CORS_ALLOWED_ORIGINS=https://aim-set-2-0-web.vercel.app,http://localhost:3000" 2>/dev/null \
  || railway variables --set "CORS_ALLOWED_ORIGINS=https://aim-set-2-0-web.vercel.app,http://localhost:3000"
railway variables set "KB_INGEST_SYNC=true" 2>/dev/null || railway variables --set "KB_INGEST_SYNC=true"

echo ""
echo "Redeploying..."
railway up --detach 2>/dev/null || railway redeploy

echo ""
echo "Next: Railway → @dc-copilot/api → Settings → Networking → Generate Domain"
echo "Then set PUBLIC_API_BASE_URL to that URL and run:"
echo "  ./scripts/verify-api-health.sh https://YOUR-URL.up.railway.app"
