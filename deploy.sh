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
#   SMOKE_URL  base url for the post-deploy smoke (default https://$SERVER_IP)
#   CURL_OPTS  passed through to smoke.sh's curl. Default hits the box over its
#              self-signed TLS (-k).
set -eu

APP_DIR="${APP_DIR:-/opt/uceltic}"
SMOKE_URL="${SMOKE_URL:-https://${SERVER_IP:-localhost}}"
cd "$APP_DIR"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

$COMPOSE pull
$COMPOSE up -d

: "${CURL_OPTS:=-k}"
export CURL_OPTS
if ! ./scripts/smoke.sh "$SMOKE_URL"; then
  echo "deploy.sh: post-deploy smoke FAILED against $SMOKE_URL" >&2
  exit 1
fi
echo "deploy.sh: deploy OK"