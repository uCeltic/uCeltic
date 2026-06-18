# 2. Automated continuous delivery via a pull-based VPS agent

- Status: Accepted
- Date: 2026-06-16
- Deciders: Zhou Dejian
- Supersedes: parts of [ADR-0001](0001-private-vps-deployment.md) — specifically its
  "this is a human-driven deploy … not an unattended agent task" stance and its
  on-box `--build` flow.

## Context

ADR-0001 deploys the stack privately to a single CentOS VPS and builds the images
**on the box** at deploy time (`docker compose up -d --build`), triggered by a human.
That leaves two gaps:

1. **What CI tests ≠ what runs in prod.** CI validates source + unit tests; prod runs
   images assembled on the VPS. A broken Dockerfile, a missing dependency, or a failing
   `collectstatic`/`migrate` only surfaces on the box, at the worst possible moment.
2. **No automation.** Every deploy is a manual, error-prone ritual.

We want real continuous delivery (automatic on a green `main`) **without weakening the
security posture ADR-0001 established**: secrets live only on the box, the host firewall
exposes only 22/80/443, and there must be **no inbound automation channel into the VPS**.

## Decision

Introduce a pull-based CD pipeline. GitHub **never connects to the VPS**; it only writes
to the registry, and the VPS pulls.

**Artifacts (GHCR, private, follows repo visibility).** CI builds two images — `backend`
and `client` — and publishes each with an **immutable** `sha-<gitsha>` tag plus a moving
`prod` pointer. `sha-<gitsha>` is the reproducible artifact; `prod` means "latest blessed
build".

**Gate.** After building, CI brings up the assembled stack (`docker compose up -d`) and
runs a **smoke test** asserting:

- `GET /api/tei/` → `200` (proves backend boots, DB connects, migrations are applied, and
  Caddy proxies `/api`), and
- `GET /` → `200` containing `id="root"` (proves the client image builds and is served).

A `makemigrations --check --dry-run` step guards against migration drift the smoke test
can miss. **Only when all gates are green** does CI advance the `prod` pointer
(`docker buildx imagetools create`).

**Delivery (pull-based).** A systemd `oneshot` service + timer on the VPS polls every
**2 minutes**: `docker compose pull` + `up -d`. When the `prod` digest is unchanged it is
a no-op. Migrations run as the existing `entrypoint.sh` side effect. After `up -d` the
unit re-runs the same two smoke assertions against the live box and logs to journald.

**Connectivity.** The only flows are GitHub→GHCR (write) and VPS→GHCR (read, via a
fine-grained PAT scoped to `packages:read`, stored in root's docker config on the box).
Port 22 stays closed to automation; no SSH key lives in CI; secrets remain only on the box.

**Rollback.** A `workflow_dispatch` with a `sha` input re-points `prod` to a previous good
`sha` via `imagetools`; the VPS picks it up within 2 minutes. This is GitHub→GHCR only and
never touches the VPS. `prod` = "latest blessed build", and rolling it back is the entire
rollback surface.

The prod compose overlay changes from `build:` to `image:` pulling the `prod` tag.

## Consequences

- The image CI tests is byte-identical to the image prod runs. Deploy-time surprises
  (broken Dockerfile, missing dep, failed `collectstatic`/`migrate`) are caught in CI.
- Deploy is automatic within ~2 min of a green `main`, with no human on the box on the
  happy path. "Deploy now" = run the unit manually on the box; it still cannot bypass the
  smoke gate, because `prod` only moves after CI is green.
- Rollback is a GitHub UI action (`workflow_dispatch` + sha); no VPS login required.
- Requires a fine-grained PAT (`packages:read`) on the box; rotation = re-`docker login`.

### Accepted risks

- **No "freeze" semantics.** A push to `main` during an incident can re-advance `prod`
  over a rollback. Acceptable for a 1–2 committer private instance; the next push is
  usually the fix itself. We explicitly rejected a `DEPLOY_SHA` pin escape hatch to keep
  the model simple.
- **~2-min latency** and a brief backend/client version-skew window during recreate.
  Acceptable for a single-box, low-traffic, IP-only private instance — no blue/green.

## Rejected alternatives

- **Push-based deploy (GitHub Actions SSH into the VPS).** Reopens inbound 22 to GitHub
  runners and puts an SSH key in CI secrets — directly weakens ADR-0001's posture.
- **Watchtower as the pull agent.** Per-container auto-recreate gives no ordering control
  and no post-deploy health check on the box.
- **`latest`-only tagging.** No gate (the VPS could pull before the smoke test passes) and
  no clean rollback target.
- **A `DEPLOY_SHA` pin escape hatch.** Rejected for simplicity; re-pointing `prod` (the
  rollback above) is enough at this scale.
