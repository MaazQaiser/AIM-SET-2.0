#!/usr/bin/env bash
# Local live-call testing — Frontera franchise AI platform scenario (no Recall).
# Requires: API running with DEMO_TRANSCRIPT_REPLAY=true in services/api/.env
# Usage: ./scripts/demo_live_call_segments.sh [call_id] [api_base]

set -euo pipefail

CALL_ID="${1:-frontera-franchise-group}"
API="${2:-http://127.0.0.1:8000}"
TENANT="${DEMO_TENANT_ID:-demo-tenant}"
USER="${DEMO_USER_ID:-demo-user}"

post_segment() {
  local text="$1"
  local role="${2:-customer}"
  local offset="${3:-0}"
  curl -s -X POST \
    "${API}/api/v1/webhooks/recall/demo-segment?call_id=${CALL_ID}&tenant_id=${TENANT}&user_id=${USER}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"${text}\",\"speaker_role\":\"${role}\",\"offset_seconds\":${offset}}" \
    | python3 -c "import sys,json; o=json.load(sys.stdin); print('  ->', o.get('live',{}).get('operation','?'), '| nudge:', bool(o.get('nudge')), '| ws msgs:', len(o.get('ws_messages') or []))"
}

echo "Live call demo — Frontera franchise AI platform — call_id=${CALL_ID}"
echo "Open: http://localhost:3002/calls/${CALL_ID}/live"
echo "Pre-brief: http://localhost:3002/calls/${CALL_ID}"
echo ""

post_segment "Thanks Marcus — we'll focus on franchise operations modernization." "ae" 8
sleep 1
post_segment "We need an AI-native platform to run franchise operations — I'm expecting a formal proposal after today." "customer" 22
sleep 1
post_segment "Operators live in spreadsheets and POS integrations — zero real-time unit performance across 140 locations." "customer" 52
sleep 1
post_segment "Manual compliance audits bottleneck us before the next regional expansion wave." "customer" 68
sleep 1
post_segment "Budget is roughly four hundred fifty to six hundred thousand year one — board blesses it in May." "customer" 95
sleep 1
post_segment "We want a Q3 pilot in Texas and Arizona — production go-live by Q1 next year." "customer" 108
sleep 1
post_segment "Why partner instead of our internal orchestration prototype?" "customer" 118
sleep 2
post_segment "You keep brand rules — we ship production agent fabric and franchisee permission boundaries." "se" 132
sleep 1
post_segment "Multi-tenant agent mesh is exactly what our architecture review asked for — that's encouraging." "customer" 148
sleep 1
post_segment "We'll send a board-ready proposal in two weeks with pilot scope and retail references." "ae" 165

echo ""
echo "Done. Check live cockpit: sentiment, pains, intent, BANT, keywords, discovery coverage."
