#!/bin/sh
# Smoke-test the assembled stack. The same script runs in CI and (later, #38) on
# the VPS, so keep it POSIX sh and dependency-free.
# Usage: smoke.sh <base-url>   e.g. smoke.sh http://localhost:80
#
# Tunables (env): SMOKE_RETRIES (default 30), SMOKE_DELAY seconds (default 2),
# SMOKE_MAX_TIME seconds per curl attempt (default 10).
set -eu
BASE="$1"
RETRIES="${SMOKE_RETRIES:-30}"
DELAY="${SMOKE_DELAY:-2}"
# Cap every attempt. A dropped port (cloud firewall) accepts the connection and
# then goes silent; curl has no total timeout by default, so without this the
# retry budget is unbounded and a failed deploy hangs instead of failing.
MAX_TIME="${SMOKE_MAX_TIME:-10}"
# Extra curl flags, deliberately unquoted so multiple flags word-split into
# args. Empty by default (CI uses plain http; the VPS has a real cert, #63).
CURL_OPTS="${CURL_OPTS:-}"

# Wait for the backend to be ready. While it boots (migrate, gunicorn) Caddy
# answers /api with 5xx; before Caddy itself is up the connection is refused and
# curl reports 000. Retry until 200 or we exhaust the budget.
i=1
while :; do
code=$(curl --max-time "$MAX_TIME" $CURL_OPTS -s -o /dev/null -w '%{http_code}' "$BASE/api/tei/" || true)
if [ "$code" = "200" ]; then break; fi
if [ "$i" -ge "$RETRIES" ]; then
    echo "FAIL: GET /api/tei/ -> $code (want 200) after $i attempts"
    exit 1
fi
i=$((i + 1))
sleep "$DELAY"
done

# Accounts (#64). The auth API is mounted under /api/auth/, so a proxy rule that only
# knows the older paths would leave registration dead on a stack that otherwise looks
# healthy. This endpoint plants the CSRF cookie the SPA needs and answers 204.
code=$(curl --max-time "$MAX_TIME" $CURL_OPTS -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/csrf/" || true)
if [ "$code" != "204" ]; then
    echo "FAIL: GET /api/auth/csrf/ -> $code (want 204)"
    exit 1
fi

curl --max-time "$MAX_TIME" $CURL_OPTS -fsS "$BASE/" | grep -q 'id="root"' || { echo 'FAIL: GET / missing id="root"'; exit 1; }
echo "smoke OK"