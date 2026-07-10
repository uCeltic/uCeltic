#!/bin/sh
# Pull-based deploy for the VPS (issue #38). The systemd timer runs this every
# ~2 min: pull the blessed :prod images, recreate the stack if they changed,
# then smoke-test the live box. A non-zero exit (logged to journald) means the
# pull/up or the post-deploy smoke failed.
#
# `up -d` is a no-op when the :prod digest is unchanged (compose only recreates
# containers whose image/config moved), so the steady state is cheap. The smoke
# still runs each cycle, doubling as a liveness check in journald.
#
# Tunables (env):
#   APP_DIR    repo checkout on the box (default /opt/uceltic)
#   SMOKE_URL  base url for the post-deploy smoke (default the sslip.io host,
#              matching Caddyfile.prod; SERVER_IP comes from the systemd
#              EnvironmentFile). The Let's Encrypt cert is real, so the smoke
#              also verifies TLS (no -k).
#   CURL_OPTS  passed through to smoke.sh's curl.
set -eu

APP_DIR="${APP_DIR:-/opt/uceltic}"
# Fail fast with a clear message if the box .env lacks SERVER_IP.
SMOKE_URL="${SMOKE_URL:-https://${SERVER_IP:?SERVER_IP must be set in the box .env}.sslip.io}"
cd "$APP_DIR"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

$COMPOSE pull
$COMPOSE up -d

if ! ./scripts/smoke.sh "$SMOKE_URL"; then
  echo "deploy.sh: post-deploy smoke FAILED against $SMOKE_URL" >&2
  exit 1
fi
echo "deploy.sh: deploy OK"