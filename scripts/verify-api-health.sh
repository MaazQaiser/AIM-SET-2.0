#!/usr/bin/env bash
# Verify deployed API is ready for Vercel + Supabase + KB.
# Usage: ./scripts/verify-api-health.sh https://your-api-host.example.com

set -euo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "Usage: $0 <API_BASE_URL>" >&2
  exit 1
fi

BASE="${BASE%/}"
URL="${BASE}/health"

echo "GET $URL"
BODY=$(curl -sf "$URL")
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

for key in supabase_configured openai_configured kb_ingest_sync; do
  if ! echo "$BODY" | grep -q "\"$key\": true"; then
    echo "WARN: $key is not true — fix API env before using Vercel production." >&2
    exit 1
  fi
done

echo "OK: API is configured for Supabase + KB ingest."
