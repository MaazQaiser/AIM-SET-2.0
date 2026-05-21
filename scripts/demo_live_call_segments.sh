#!/usr/bin/env bash
# Local live-call testing (plan option 3) — no Recall account required.
# Requires: API running with DEMO_TRANSCRIPT_REPLAY=true in services/api/.env
# Usage: ./scripts/demo_live_call_segments.sh [call_id] [api_base]

set -euo pipefail

CALL_ID="${1:-call-meridian-financial}"
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

echo "Live call demo replay — call_id=${CALL_ID}"
echo "Open: http://localhost:3002/calls/${CALL_ID}/live (WebSocket must connect to ${API})"
echo ""

post_segment "Thanks for joining — quick intro from our side." "ae" 10
sleep 1
post_segment "We filed an updated Form ADV last week and our ESG mandate is expanding." "customer" 60
sleep 1
post_segment "Our budget for Q3 is still tight compared to last year." "customer" 120
sleep 1
post_segment "We are also evaluating Salesforce as an alternative vendor." "customer" 125
sleep 1
post_segment "What would have to be true for your board to approve this?" "customer" 130
sleep 2
post_segment "Great question — typically regulatory liability quantified and phased investment." "ae" 155
sleep 1
post_segment "How do you handle intraday reconciliation across multiple custodians?" "customer" 200
sleep 1
post_segment "We did this for a Boston hedge fund — pattern was split custody feeds into one ledger." "se" 210

echo ""
echo "Done. Check the live cockpit for nudges, intent, KB, objections, and suggestion log."
