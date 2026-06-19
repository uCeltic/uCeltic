# CD pipeline — pull-based delivery to the private VPS

Concrete design for [ADR-0002](adr/0002-automated-cd-pull-based.md). This is the
implementation reference; the ADR holds the *why*.

## Flow

```
 push to main ─▶ CI ────────────────────────────────────────────────┐
                 │ 1. build backend + client images                  │
                 │ 2. push immutable  ghcr.io/<repo>/{backend,client}:sha-<gitsha>
                 │ 3. gate: makemigrations --check                    │
                 │ 4. gate: docker compose up -d + smoke              │
                 │ 5. green → imagetools: move :prod ─▶ :sha-<gitsha> │
                 └───────────────────────────────────────────────────┘
                                                                       │ writes
                                                              ┌────────▼────────┐
                                                              │   GHCR (private)│
                                                              └────────▲────────┘
                                                                       │ pulls (read PAT)
   VPS: systemd timer every 2 min ─▶ uceltic-deploy.service ───────────┘
        docker compose pull && up -d  (no-op if :prod digest unchanged)
        entrypoint.sh runs migrate + collectstatic
        post-deploy smoke against the live box → journald

 Rollback: workflow_dispatch(sha) ─▶ imagetools move :prod ─▶ :sha-<old>
           VPS picks it up within 2 min. Never touches the box.
```

`prod` = "latest blessed build". The smoke gate (step 4) is what stands between a push and
`prod` moving, so the VPS can only ever pull an image that passed smoke.

## Smoke assertions (used in both CI gate and on-box post-deploy)

Against the assembled stack (base `docker-compose.yml`, dev Caddyfile, **no** Basic Auth):

1. `GET /api/tei/` → `200` — backend boots, DB connects, migrations applied, Caddy proxies `/api`.
2. `GET /` → `200` and body contains `id="root"` — client image builds and is served.

Nothing about data content (the CI DB is empty). Search correctness stays in unit tests.

## CI additions (`.github/workflows/ci.yml`)

Keep the existing `backend` and `frontend` jobs (fast PR feedback). Add, gated on
`push` to `main`:

```yaml
# add near the top so superseded runs are cancelled
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# in the existing backend job, before the coverage step:
      - name: Migration drift check
        run: python manage.py makemigrations --check --dry-run

  release:
    name: Build, smoke, and bless :prod
    needs: [backend, frontend]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    env:
      REGISTRY: ghcr.io
      IMAGE_PREFIX: ghcr.io/${{ github.repository }}
      SHA_TAG: sha-${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          push: true
          tags: ${{ env.IMAGE_PREFIX }}/backend:${{ env.SHA_TAG }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build client
        uses: docker/build-push-action@v6
        with:
          context: .
          file: client/Dockerfile
          push: true
          tags: ${{ env.IMAGE_PREFIX }}/client:${{ env.SHA_TAG }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Smoke test the assembled stack
        env:
          BACKEND_IMAGE: ${{ env.IMAGE_PREFIX }}/backend:${{ env.SHA_TAG }}
          CLIENT_IMAGE: ${{ env.IMAGE_PREFIX }}/client:${{ env.SHA_TAG }}
        run: |
          cp .env.ci .env   # SECRET_KEY/DB_* test values committed for CI only
          docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d
          ./scripts/smoke.sh http://localhost:80
          docker compose down -v

      - name: Bless :prod (only if smoke passed)
        run: |
          for img in backend client; do
            docker buildx imagetools create \
              --tag ${IMAGE_PREFIX}/$img:prod \
              ${IMAGE_PREFIX}/$img:${SHA_TAG}
          done
```

`docker-compose.ci.yml` is a tiny overlay that points `backend`/`web` at
`${BACKEND_IMAGE}`/`${CLIENT_IMAGE}` instead of `build:`. `.env.ci` carries throwaway
`SECRET_KEY`/`DB_*` values (safe to commit — CI only, never prod).

## Rollback workflow (`.github/workflows/rollback.yml`)

```yaml
name: Rollback :prod
on:
  workflow_dispatch:
    inputs:
      sha:
        description: "git sha to roll prod back to (the sha-XXXX tag, sha part only)"
        required: true
jobs:
  rollback:
    name: Move :prod back to a prior sha
    runs-on: ubuntu-latest
    permissions: { packages: write }
    env:
      SHA_TAG: sha-${{ inputs.sha }}
    steps:
      # github.repository is uCeltic/uCeltic; GHCR rejects uppercase, so lowercase
      # the prefix exactly as ci.yml's release job does.
      - run: echo "IMAGE_PREFIX=ghcr.io/$(echo "${GITHUB_REPOSITORY}" | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_ENV"
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          for img in backend client; do
            docker buildx imagetools create \
              --tag "${IMAGE_PREFIX}/${img}:prod" \
              "${IMAGE_PREFIX}/${img}:${SHA_TAG}"
          done
```

The VPS pulls the rolled-back `prod` within 2 minutes. Reminder (ADR-0002 accepted risk):
the next push to `main` will re-advance `prod` — there is no freeze.

## Shared smoke script (`scripts/smoke.sh`)

```sh
#!/bin/sh
# Usage: smoke.sh <base-url>   e.g. smoke.sh http://localhost:80
set -e
BASE="$1"
for i in $(seq 1 30); do
  if curl -fsS "$BASE/api/tei/" >/dev/null 2>&1; then break; fi
  sleep 2
done
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/tei/")
[ "$code" = "200" ] || { echo "FAIL /api/tei/ -> $code"; exit 1; }
curl -fsS "$BASE/" | grep -q 'id="root"' || { echo "FAIL / missing #root"; exit 1; }
echo "smoke OK"
```

## VPS prod overlay change (`docker-compose.prod.yml`)

Replace the on-box build with a registry pull:

```yaml
services:
  backend:
    image: ghcr.io/<owner>/<repo>/backend:prod   # was: build: ./backend
    restart: unless-stopped
  web:
    image: ghcr.io/<owner>/<repo>/client:prod     # was: build (client/Dockerfile)
    restart: unless-stopped
    env_file: .env
    ports: ["443:443"]
    volumes:
      - ./Caddyfile.prod:/etc/caddy/Caddyfile:ro
      - caddydata:/data
```

## VPS one-time setup

1. **Registry login** (read-only PAT, `packages:read` on this repo only):
   ```sh
   echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
   ```
   Rotation = re-run this with a fresh PAT.

2. **Deploy script** `/opt/uceltic/deploy.sh`:
   ```sh
   #!/bin/sh
   set -e
   cd /opt/uceltic
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ./scripts/smoke.sh https://localhost:443 || {
     echo "post-deploy smoke FAILED"; exit 1; }
   ```
   (`smoke.sh` over self-signed TLS needs `curl -k`; add `-k` in a prod variant or set
   `CURL_OPTS=-k`.)

3. **systemd units** (oneshot + timer, non-overlapping, journald logs):
   ```ini
   # /etc/systemd/system/uceltic-deploy.service
   [Unit]
   Description=uCeltic pull-based deploy
   After=docker.service
   [Service]
   Type=oneshot
   ExecStart=/opt/uceltic/deploy.sh
   ```
   ```ini
   # /etc/systemd/system/uceltic-deploy.timer
   [Unit]
   Description=Poll GHCR :prod every 2 min
   [Timer]
   OnBootSec=2min
   OnUnitActiveSec=2min
   [Install]
   WantedBy=timers.target
   ```
   ```sh
   systemctl daemon-reload
   systemctl enable --now uceltic-deploy.timer
   ```

- **Deploy now:** `systemctl start uceltic-deploy.service` (still bound by the smoke gate —
  it can only pull what CI already blessed).
- **Logs:** `journalctl -u uceltic-deploy -f`.

## Open follow-ups (not in this ADR)

- Dependabot (`pip` + `npm` + `github-actions` + `docker`) and a frontend coverage gate —
  hygiene items from the original review, independent of this pipeline.
