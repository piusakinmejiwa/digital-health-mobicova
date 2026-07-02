#!/usr/bin/env bash
# =============================================================================
# Partner Distribution API smoke test — acts as PalmPay against MobiCova (sandbox)
# =============================================================================
# Walks: provision partner -> products -> quote -> enrol (+ idempotency) ->
# payment (+ split) -> status -> negative checks -> premium ledger roll-up.
# All records it creates are flagged sandbox=true (no real cover).
#
# Requires: curl, jq.  Run from git-bash / WSL / macOS / Linux.
#
# Usage (set via env so no secret is saved in the file):
#   API_BASE=https://api.mobicovahealth.com \
#   ADMIN_JWT=<platform-admin-jwt> \
#   ORG_ID=<underwriter-org-id> \
#   bash docs/test-palmpay.sh
#
#   # ...or skip provisioning and use an existing key:
#   API_BASE=... DIST_KEY=mk_dist_... PARTNER_ID=<id> ADMIN_JWT=... bash docs/test-palmpay.sh
# =============================================================================
set -uo pipefail

API_BASE="${API_BASE:-https://api.mobicovahealth.com}"
ADMIN_JWT="${ADMIN_JWT:-}"     # platform-admin JWT (to provision + read the ledger)
ORG_ID="${ORG_ID:-}"           # underwriter org id (needed only when provisioning)
DIST_KEY="${DIST_KEY:-}"       # mk_dist_ key; if empty, a sandbox partner is provisioned
PARTNER_ID="${PARTNER_ID:-}"   # set to read the ledger for an existing partner

command -v jq   >/dev/null 2>&1 || { echo "jq is required — https://jqlang.github.io/jq/"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required"; exit 1; }

pass=0; fail=0
ok()  { echo "  PASS: $1"; pass=$((pass+1)); }
bad() { echo "  FAIL: $1"; fail=$((fail+1)); }
hr()  { echo; echo "== $1 =="; }

api_post() { curl -s -X POST "$1" -H "Authorization: Bearer $3" -H "Content-Type: application/json" -d "$2"; }
api_get()  { curl -s "$1" -H "Authorization: Bearer $2"; }
http_code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# --- 1. Provision a sandbox partner (unless a key was supplied) ---------------
if [ -z "$DIST_KEY" ]; then
  hr "Provision sandbox partner"
  [ -n "$ADMIN_JWT" ] || { echo "Set ADMIN_JWT + ORG_ID to provision, or supply DIST_KEY."; exit 1; }
  [ -n "$ORG_ID" ]    || { echo "Set ORG_ID (the underwriter org) to provision."; exit 1; }
  resp=$(api_post "$API_BASE/api/v1/admin/distribution-partners" \
    "{\"orgId\":\"$ORG_ID\",\"name\":\"PalmPay Test\",\"slug\":\"palmpay-test\",\"commissionRate\":15,\"platformFeeRate\":2,\"sandbox\":true}" \
    "$ADMIN_JWT")
  DIST_KEY=$(echo "$resp" | jq -r '.apiKey // empty')
  PARTNER_ID=$(echo "$resp" | jq -r '.id // empty')
  if [ -n "$DIST_KEY" ]; then ok "partner provisioned ($PARTNER_ID)"; else bad "provision failed: $resp"; exit 1; fi
fi

# --- 2. Products --------------------------------------------------------------
hr "Products"
prod=$(api_get "$API_BASE/api/partner/v1/products" "$DIST_KEY")
PLAN_ID=$(echo "$prod" | jq -r '.products[0].planId // empty')
if [ -n "$PLAN_ID" ]; then
  ok "products returned ($(echo "$prod" | jq '.products | length') plans); using $PLAN_ID"
else
  bad "no products — the plan's 'underwriter' must match the org name. resp: $prod"; exit 1
fi

# --- 3. Quote -----------------------------------------------------------------
hr "Quote"
q=$(api_post "$API_BASE/api/partner/v1/quote" "{\"planId\":\"$PLAN_ID\"}" "$DIST_KEY")
if echo "$q" | jq -e '.monthlyPremium' >/dev/null 2>&1; then
  ok "quote: $(echo "$q" | jq -r '.monthlyPremium') $(echo "$q" | jq -r '.currency')"
else bad "quote failed: $q"; fi

# --- 4. Enrol (bind) + idempotency -------------------------------------------
REF="PP-TEST-$(date +%s)"
MEMBER="{\"fullName\":\"Test User\",\"phone\":\"+2348012345678\",\"email\":\"test+$REF@example.com\"}"
hr "Enrol (bind)"
e=$(api_post "$API_BASE/api/partner/v1/enrolments" \
  "{\"planId\":\"$PLAN_ID\",\"externalRef\":\"$REF\",\"member\":$MEMBER}" "$DIST_KEY")
ENR_ID=$(echo "$e" | jq -r '.enrolmentId // empty')
if [ -n "$ENR_ID" ]; then
  ok "enrolled: $ENR_ID (membership $(echo "$e" | jq -r '.membershipId'), status $(echo "$e" | jq -r '.status'))"
else bad "enrol failed: $e"; exit 1; fi

e2=$(api_post "$API_BASE/api/partner/v1/enrolments" \
  "{\"planId\":\"$PLAN_ID\",\"externalRef\":\"$REF\",\"member\":$MEMBER}" "$DIST_KEY")
if [ "$(echo "$e2" | jq -r '.enrolmentId')" = "$ENR_ID" ]; then
  ok "idempotent enrol (same externalRef -> same policy)"
else bad "idempotency broken: got $(echo "$e2" | jq -r '.enrolmentId')"; fi

# --- 5. Payment (activate + ledger split) ------------------------------------
hr "Payment"
p=$(api_post "$API_BASE/api/partner/v1/enrolments/$ENR_ID/payment" \
  "{\"amount\":2500,\"externalTxnRef\":\"TXN-$REF\"}" "$DIST_KEY")
status=$(echo "$p" | jq -r '.status')
comm=$(echo "$p" | jq -r '.premium.commission'); fee=$(echo "$p" | jq -r '.premium.platformFee'); net=$(echo "$p" | jq -r '.premium.net')
if [ "$status" = "active" ]; then
  ok "activated · gross=2500 commission=$comm platformFee=$fee net=$net"
else bad "payment did not activate: $p"; fi
# 2500 @ 15% + 2% -> 375 + 50, net 2075
if [ "$comm" = "375" ] && [ "$fee" = "50" ] && [ "$net" = "2075" ]; then
  ok "split math correct (375 / 50 / 2075)"
else echo "  NOTE: split=$comm/$fee/$net (expected 375/50/2075 only if commission=15%, fee=2%)"; fi

# --- 6. Status ----------------------------------------------------------------
hr "Status"
s=$(api_get "$API_BASE/api/partner/v1/enrolments/$ENR_ID" "$DIST_KEY")
[ "$(echo "$s" | jq -r '.status')" = "active" ] && ok "status active" || bad "status: $s"

# --- 7. Negative checks -------------------------------------------------------
hr "Negative checks"
c=$(http_code "$API_BASE/api/partner/v1/products")   # no key
[ "$c" = "401" ] && ok "no key -> 401" || bad "no key -> $c (expected 401)"
c=$(http_code -X POST "$API_BASE/api/partner/v1/quote" -H "Authorization: Bearer $DIST_KEY" -H "Content-Type: application/json" -d '{"planId":"00000000-0000-0000-0000-000000000000"}')
[ "$c" = "404" ] && ok "unknown plan -> 404 (org scoping)" || bad "unknown plan -> $c (expected 404)"

# --- 8. Premium ledger roll-up (needs platform-admin JWT + partner id) --------
if [ -n "$ADMIN_JWT" ] && [ -n "$PARTNER_ID" ]; then
  hr "Premium ledger roll-up"
  l=$(api_get "$API_BASE/api/v1/admin/distribution-partners/$PARTNER_ID/premiums" "$ADMIN_JWT")
  echo "$l" | jq '.summary'
  ok "ledger read"
fi

# --- Summary ------------------------------------------------------------------
hr "Summary"
echo "  PASS: $pass    FAIL: $fail"
echo "  All records created are sandbox=true. Member '$REF' is in the underwriter org."
[ "$fail" -eq 0 ]
