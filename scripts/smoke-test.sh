#!/usr/bin/env bash
# scripts/smoke-test.sh — end-to-end smoke test against a deployed Apps Script
# Web App. Verifies: ping → register → idempotent register → checkin → cooldown
# → auto-upgrade → DNF → state. Run once right after deploying the backend.
#
# Usage:
#   ./scripts/smoke-test.sh <WEBAPP_URL> [DASHBOARD_KEY]
#
# WEBAPP_URL = the /exec URL Apps Script gave you after "Deploy → Web app".
# DASHBOARD_KEY = optional, only if STATE_KEY is set in Script Properties.

set -euo pipefail

URL="${1:-}"
KEY="${2:-}"
if [[ -z "$URL" ]]; then
  echo "usage: $0 <WEBAPP_URL> [DASHBOARD_KEY]" >&2; exit 2
fi

# ANSI helpers
g(){ printf '\033[32m%s\033[0m\n' "$*"; }
r(){ printf '\033[31m%s\033[0m\n' "$*"; }
y(){ printf '\033[33m%s\033[0m\n' "$*"; }
b(){ printf '\033[1m%s\033[0m\n' "$*"; }

# Apps Script POST quirk: must send body as text/plain, not JSON.
call() {
  local action="$1"; local method="${2:-GET}"; local data="${3:-}"
  if [[ "$method" == "POST" ]]; then
    curl -sSL -X POST -H 'Content-Type: text/plain;charset=utf-8' \
      --data "$data" "$URL?action=$action"
  else
    local q="action=$action${data:+&$data}"
    curl -sSL "$URL?$q"
  fi
}

j() { node -e "
  const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
  const path = process.argv[1];
  const get = (o,p) => p.split('.').reduce((a,k)=> a==null?a:a[k], o);
  const v = get(d, path);
  process.stdout.write(typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
" "$1"; }

# Use a unique phone per run so re-running doesn't collide
PHONE="098$(printf '%07d' $((RANDOM * RANDOM % 10000000)))"
NAME="smoke-$(date +%s)"

b "🔌 Testing $URL"

# 1. Ping
y "[1/8] ping…"
RES=$(call ping)
[[ "$(echo "$RES" | j ok)" == "true" ]] || { r "✗ ping failed: $RES"; exit 1; }
g "    ✓ ping ok"

# 2. Register (11K so we can test auto-upgrade)
y "[2/8] register $NAME ($PHONE, 11K)…"
RES=$(call register POST "{\"name\":\"$NAME\",\"phone\":\"$PHONE\",\"distance\":\"11K\"}")
[[ "$(echo "$RES" | j ok)" == "true" ]] || { r "✗ register: $RES"; exit 1; }
TOKEN=$(echo "$RES" | j token)
RID=$(echo "$RES" | j runner.id)
[[ -n "$TOKEN" && "$TOKEN" != "undefined" ]] || { r "✗ no token in response"; exit 1; }
g "    ✓ registered → token=${TOKEN:0:8}…  id=$RID"

# 3. Re-register same phone (must be idempotent)
y "[3/8] re-register same phone (idempotency)…"
RES=$(call register POST "{\"name\":\"$NAME\",\"phone\":\"$PHONE\",\"distance\":\"11K\"}")
ACT=$(echo "$RES" | j action)
[[ "$ACT" == "already_registered" ]] || { r "✗ expected already_registered, got: $ACT"; exit 1; }
g "    ✓ idempotent (action=already_registered)"

# 4. Check in at A2 (should auto-upgrade 11K → 22K)
y "[4/8] checkin A2 (expect auto-upgrade 11K → 22K)…"
RES=$(call checkin POST "{\"token\":\"$TOKEN\",\"cp\":\"a2\"}")
ACT=$(echo "$RES" | j action)
[[ "$ACT" == "upgrade_11_22" ]] || { r "✗ expected upgrade_11_22, got: $ACT (full=$RES)"; exit 1; }
DIST=$(echo "$RES" | j runner.distance_current)
[[ "$DIST" == "22K" ]] || { r "✗ expected distance_current=22K, got: $DIST"; exit 1; }
g "    ✓ upgrade_11_22 · distance_current=22K"

# 5. Immediate re-checkin at A2 (cooldown)
y "[5/8] re-checkin A2 immediately (expect cooldown)…"
RES=$(call checkin POST "{\"token\":\"$TOKEN\",\"cp\":\"a2\"}")
OK=$(echo "$RES" | j ok)
ERR=$(echo "$RES" | j error)
WAIT=$(echo "$RES" | j wait_ms)
[[ "$OK" == "false" && "$ERR" == "cooldown" ]] || { r "✗ expected cooldown, got: $RES"; exit 1; }
g "    ✓ cooldown · wait_ms=$WAIT (~$((WAIT/60000)) min)"

# 6. Lookup (browser-recall path)
y "[6/8] lookup token (recognized screen)…"
RES=$(call lookup GET "token=$TOKEN")
[[ "$(echo "$RES" | j ok)" == "true" ]] || { r "✗ lookup: $RES"; exit 1; }
N=$(echo "$RES" | j runner.name)
[[ "$N" == "$NAME" ]] || { r "✗ name mismatch: $N vs $NAME"; exit 1; }
g "    ✓ lookup ok · runner.name=$N"

# 7. Search (borrowed-phone fallback)
y "[7/8] search (autocomplete)…"
PFX=$(echo "$NAME" | cut -c1-3)
RES=$(call search GET "q=$PFX")
[[ "$(echo "$RES" | j ok)" == "true" ]] || { r "✗ search: $RES"; exit 1; }
g "    ✓ search ok"

# 8. DNF
y "[8/8] DNF (2-step confirm)…"
RES=$(call dnf POST "{\"token\":\"$TOKEN\",\"cp\":\"a2\",\"reason\":\"exhausted\",\"note\":\"smoke test\",\"pickup_requested\":true}")
[[ "$(echo "$RES" | j ok)" == "true" ]] || { r "✗ dnf: $RES"; exit 1; }
STATUS=$(echo "$RES" | j runner.status)
[[ "$STATUS" == "dnf" ]] || { r "✗ expected status=dnf, got: $STATUS"; exit 1; }
g "    ✓ DNF recorded · status=dnf"

# 9. (Bonus) state — locked-down if STATE_KEY is set
y "[bonus] state (dashboard endpoint)…"
PARAMS=""
[[ -n "$KEY" ]] && PARAMS="key=$KEY"
RES=$(call state GET "$PARAMS")
OK=$(echo "$RES" | j ok)
if [[ "$OK" == "true" ]]; then
  N=$(echo "$RES" | j runners | tr -cd ',' | wc -c)
  g "    ✓ state ok · $((N+1)) runner(s) total"
else
  ERR=$(echo "$RES" | j error)
  if [[ "$ERR" == "unauthorized" ]]; then
    y "    ⚠ state is locked (STATE_KEY set) — pass DASHBOARD_KEY as arg 2 to test"
  else
    r "✗ state: $RES"; exit 1
  fi
fi

echo
g "✅ OK · all checks passed"
y "🧹 To clean up: open the sheet and delete the row with name='$NAME' from Runners/Checkins/DNF tabs."
