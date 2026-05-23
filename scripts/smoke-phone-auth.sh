#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Phone-SMS auth smoke tests (Dev Rules §Phase 4 — Validation & Testing)
#
# Usage:
#   chmod +x scripts/smoke-phone-auth.sh
#   ./scripts/smoke-phone-auth.sh                          # interactive
#   API=http://localhost:4000/api ./scripts/smoke-phone-auth.sh
#
# Requires: curl, jq, psql (optional, only for OTP read-back in dev)
#
# Reads OTP codes directly from the database (DATABASE_URL) so you don't need
# to actually wait for SMS. If psql/DATABASE_URL unavailable, the script will
# pause and prompt you to paste the code from your SMS inbox or server logs.
#
# This script is READ-ONLY against your dev DB except for the rows the API
# itself creates. It does NOT mutate the schema or seed data.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

API="${API:-http://localhost:4000/api}"
TS=$(date +%s)
EMAIL="smoke+${TS}@example.com"
PASSWORD="Smoke!Test123"
NEW_PASSWORD="Reset!Test456"
PHONE_A="${PHONE_A:-+27820000${TS: -4}}"   # phone-only signup
PHONE_B="${PHONE_B:-+27820001${TS: -4}}"   # link target
PHONE_C="${PHONE_C:-+27820002${TS: -4}}"   # invite target

PASS=0
FAIL=0
SKIP=0

# ─── helpers ────────────────────────────────────────────────────────────────
c_ok()   { printf '\033[32m✓ PASS\033[0m %s\n'  "$1"; PASS=$((PASS+1)); }
c_bad()  { printf '\033[31m✗ FAIL\033[0m %s\n   → %s\n' "$1" "$2"; FAIL=$((FAIL+1)); }
c_skip() { printf '\033[33m∼ SKIP\033[0m %s\n   → %s\n' "$1" "$2"; SKIP=$((SKIP+1)); }
section(){ printf '\n\033[1;36m── %s ──\033[0m\n' "$1"; }

# Returns body to stdout, HTTP status to fd-3
req() {
  local method=$1 path=$2 data=${3:-} token=${4:-}
  local args=(-sS -o /tmp/smoke_body.$$ -w '%{http_code}' -X "$method" "$API$path"
              -H 'Content-Type: application/json')
  [[ -n $token ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n $data  ]] && args+=(--data "$data")
  local code; code=$(curl "${args[@]}" || echo 000)
  cat /tmp/smoke_body.$$
  printf '%s' "$code" >&3
  rm -f /tmp/smoke_body.$$
}

# Read latest unused OTP for a phone+purpose from DB (dev only).
# Falls back to interactive prompt if psql/DATABASE_URL unavailable.
read_otp() {
  local phone=$1 purpose=${2:-login}
  if command -v psql >/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
    local code
    code=$(psql "$DATABASE_URL" -At -c \
      "SELECT code FROM \"OtpCode\"
        WHERE phone='$phone' AND purpose='$purpose' AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)
    if [[ -n "$code" ]]; then printf '%s' "$code"; return 0; fi
  fi
  printf '\n  Enter OTP for %s (purpose=%s): ' "$phone" "$purpose" >&2
  read -r code </dev/tty
  printf '%s' "$code"
}

# ─── 0. Health ──────────────────────────────────────────────────────────────
section '0. Server reachable'
body=$(req GET /health 3>/tmp/code.$$); code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
if [[ "$code" == "200" ]]; then c_ok "GET /health → 200"
else c_bad "GET /health" "got $code, body=$body"; echo "Aborting."; exit 1; fi

# ─── 1. Email regression: register + login (Dev Rules §1, §8) ───────────────
section '1. Email auth regression (must still work)'
body=$(req POST /auth/register "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" \
        '{name:"Smoke Test", email:$e, password:$p}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
if [[ "$code" =~ ^2 ]]; then c_ok "POST /auth/register (email) → $code"
else c_bad "POST /auth/register" "got $code, body=$body"; fi

body=$(req POST /auth/login "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" \
        '{email:$e, password:$p}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
EMAIL_TOKEN=$(echo "$body" | jq -r '.accessToken // .token // empty')
if [[ "$code" == "200" && -n "$EMAIL_TOKEN" ]]; then c_ok "POST /auth/login (email) → 200 + token"
else c_bad "POST /auth/login" "code=$code body=$body"; fi

# ─── 2. Phone signup via send-otp + verify-otp (purpose=login) ──────────────
section '2. Phone-only signup (verify-otp creates email=NULL user)'
body=$(req POST /auth/phone/send-otp "$(jq -nc --arg p "$PHONE_A" '{phone:$p}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
[[ "$code" =~ ^2 ]] && c_ok "send-otp → $code" || c_bad "send-otp" "$code $body"

OTP=$(read_otp "$PHONE_A" login)
body=$(req POST /auth/phone/verify-otp \
  "$(jq -nc --arg p "$PHONE_A" --arg c "$OTP" '{phone:$p, code:$c}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
PHONE_TOKEN=$(echo "$body" | jq -r '.accessToken // .token // empty')
PHONE_USER_EMAIL=$(echo "$body" | jq -r '.user.email // "null"')
if [[ "$code" == "200" && -n "$PHONE_TOKEN" ]]; then c_ok "verify-otp → 200 + token"
else c_bad "verify-otp" "code=$code body=$body"; fi
if [[ "$PHONE_USER_EMAIL" == "null" || -z "$PHONE_USER_EMAIL" ]]; then
  c_ok "phone-only user has email=NULL"
else
  c_bad "phone-only user email" "expected null, got $PHONE_USER_EMAIL"
fi

# ─── 3. Phone login (existing phone user re-auths via same endpoint) ────────
section '3. Phone re-login on existing phone user'
req POST /auth/phone/send-otp "$(jq -nc --arg p "$PHONE_A" '{phone:$p}')" 3>/dev/null >/dev/null
OTP=$(read_otp "$PHONE_A" login)
body=$(req POST /auth/phone/verify-otp \
  "$(jq -nc --arg p "$PHONE_A" --arg c "$OTP" '{phone:$p, code:$c}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
[[ "$code" == "200" ]] && c_ok "phone re-login → 200" || c_bad "phone re-login" "$code $body"

# ─── 4. Invalid OTP rejection ───────────────────────────────────────────────
section '4. Invalid OTP rejected'
req POST /auth/phone/send-otp "$(jq -nc --arg p "$PHONE_A" '{phone:$p}')" 3>/dev/null >/dev/null
body=$(req POST /auth/phone/verify-otp \
  "$(jq -nc --arg p "$PHONE_A" '{phone:$p, code:"000000"}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
[[ "$code" == "400" || "$code" == "401" || "$code" == "422" ]] \
  && c_ok "wrong OTP rejected → $code" \
  || c_bad "wrong OTP" "expected 4xx, got $code $body"

# ─── 5. Rate limiter trips on 6th send within 10 min ────────────────────────
section '5. OTP rate limiter (5/10min per ip:phone)'
RL_PHONE="+27820009${TS: -3}"
limited=0
for i in 1 2 3 4 5 6 7; do
  body=$(req POST /auth/phone/send-otp "$(jq -nc --arg p "$RL_PHONE" '{phone:$p}')" 3>/tmp/code.$$)
  code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
  if [[ "$code" == "429" ]]; then limited=$i; break; fi
done
if [[ $limited -ge 6 ]]; then c_ok "rate-limited on request #$limited"
elif [[ $limited -eq 0 ]]; then c_bad "rate limiter" "never tripped after 7 requests"
else c_bad "rate limiter" "tripped too early on request #$limited"; fi

# ─── 6. Link phone to email account ─────────────────────────────────────────
section '6. Link phone to email-only account'
[[ -z "$EMAIL_TOKEN" ]] && { c_skip "link-phone tests" "no EMAIL_TOKEN"; } || {
  body=$(req POST /auth/link-phone "$(jq -nc --arg p "$PHONE_B" '{phone:$p}')" "" "$EMAIL_TOKEN" 3>/tmp/code.$$)
  code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
  [[ "$code" =~ ^2 ]] && c_ok "link-phone send-otp → $code" || c_bad "link-phone" "$code $body"

  OTP=$(read_otp "$PHONE_B" link)
  body=$(req POST /auth/verify-link-phone \
    "$(jq -nc --arg p "$PHONE_B" --arg c "$OTP" '{phone:$p, code:$c}')" "$EMAIL_TOKEN" 3>/tmp/code.$$)
  code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
  if [[ "$code" == "200" ]]; then
    linked_phone=$(echo "$body" | jq -r '.user.phone // empty')
    [[ "$linked_phone" == "$PHONE_B" ]] \
      && c_ok "verify-link-phone updates user.phone = $PHONE_B" \
      || c_bad "verify-link-phone" "user.phone=$linked_phone body=$body"
  else c_bad "verify-link-phone" "$code $body"; fi

  # 6b. Conflict: try linking PHONE_A (already taken) to email account
  body=$(req POST /auth/link-phone "$(jq -nc --arg p "$PHONE_A" '{phone:$p}')" "$EMAIL_TOKEN" 3>/tmp/code.$$)
  code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
  [[ "$code" == "409" ]] && c_ok "duplicate phone link → 409" \
    || c_bad "duplicate phone link" "expected 409, got $code $body"
}

# ─── 7. Phone reset password (always-200, then verify) ──────────────────────
section '7. Phone password reset'
body=$(req POST /auth/phone/send-reset-otp "$(jq -nc --arg p "$PHONE_B" '{phone:$p}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
[[ "$code" == "200" ]] && c_ok "send-reset-otp → 200 (always)" \
  || c_bad "send-reset-otp" "expected 200, got $code $body"

# Always-200 enumeration guard: unknown phone must also return 200
body=$(req POST /auth/phone/send-reset-otp '{"phone":"+27999999999"}' 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
[[ "$code" == "200" ]] && c_ok "send-reset-otp (unknown phone) → 200 (enumeration-safe)" \
  || c_bad "send-reset-otp enumeration" "expected 200, got $code"

OTP=$(read_otp "$PHONE_B" reset)
body=$(req POST /auth/phone/reset-password \
  "$(jq -nc --arg p "$PHONE_B" --arg c "$OTP" --arg np "$NEW_PASSWORD" \
       '{phone:$p, code:$c, newPassword:$np}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
[[ "$code" == "200" ]] && c_ok "reset-password → 200" || c_bad "reset-password" "$code $body"

# 7b. Old EMAIL_TOKEN should now be invalid (sessions revoked)
body=$(req GET /users/me "" "$EMAIL_TOKEN" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
[[ "$code" == "401" || "$code" == "403" ]] \
  && c_ok "old access token invalidated after reset → $code" \
  || c_bad "session revocation" "expected 401/403, got $code $body"

# 7c. New password works
body=$(req POST /auth/login "$(jq -nc --arg e "$EMAIL" --arg p "$NEW_PASSWORD" \
        '{email:$e, password:$p}')" 3>/tmp/code.$$)
code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
NEW_EMAIL_TOKEN=$(echo "$body" | jq -r '.accessToken // .token // empty')
[[ "$code" == "200" && -n "$NEW_EMAIL_TOKEN" ]] \
  && c_ok "login with new password → 200" \
  || c_bad "login w/ new password" "$code $body"

# ─── 8. SMS invite (requires authed user + community) ───────────────────────
section '8. SMS invite'
if [[ -z "${NEW_EMAIL_TOKEN:-}" ]]; then
  c_skip "send-invite" "no NEW_EMAIL_TOKEN"
elif [[ -z "${COMMUNITY_ID:-}" ]]; then
  c_skip "send-invite" "set COMMUNITY_ID env var to a community the test user owns/belongs to"
else
  body=$(req POST /auth/send-invite \
    "$(jq -nc --arg p "$PHONE_C" --arg cid "$COMMUNITY_ID" \
         '{phone:$p, communityId:$cid}')" "$NEW_EMAIL_TOKEN" 3>/tmp/code.$$)
  code=$(cat /tmp/code.$$); rm -f /tmp/code.$$
  [[ "$code" =~ ^2 ]] && c_ok "send-invite → $code" \
    || c_bad "send-invite" "$code $body"
fi

# ─── 9. Legacy @phone.lalela.net account (manual) ───────────────────────────
section '9. Legacy @phone.lalela.net back-compat'
c_skip "legacy phone account login" \
  "Manually test: a user with email=\${digits}@phone.lalela.net should still log in via /auth/phone/verify-otp. Requires pre-existing legacy row in DB."

# ─── 10. iOS AutoFill (device-only) ─────────────────────────────────────────
section '10. iOS AutoFill of OTP'
c_skip "iOS AutoFill" "Requires physical iOS device. Verify the OTP TextInput in PhoneAuth.tsx, SecuritySection.tsx, and phone-reset.tsx surfaces the 6-digit code from the SMS notification banner."

# ─── Summary ────────────────────────────────────────────────────────────────
printf '\n\033[1m── Summary ──\033[0m\n'
printf '  Pass: %d  Fail: %d  Skip: %d\n' "$PASS" "$FAIL" "$SKIP"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
