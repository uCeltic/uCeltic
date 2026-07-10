# VPS runbook — pull-based CD (issue #38)

Operational companion to [docs/cd-pipeline.md](cd-pipeline.md) and
[ADR-0002](adr/0002-automated-cd-pull-based.md). The box never builds: a systemd
timer pulls the blessed `:prod` images every ~2 min and recreates the stack.

Assumes the repo is checked out at `/opt/uceltic` with a real `.env`
(from `.env.example`).

## One-time setup

1. **Registry login** — read-only PAT, `read:packages` on this repo only:
   ```sh
   echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
   Rotation = re-run with a fresh PAT. The token is stored in
   ~/.docker/config.json; nothing else on the box needs write access.

2. Install the units (they live in the repo under deploy/):
sudo cp /opt/uceltic/deploy/uceltic-deploy.service /etc/systemd/system/
sudo cp /opt/uceltic/deploy/uceltic-deploy.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uceltic-deploy.timer
3. Confirm the timer is armed:
systemctl list-timers uceltic-deploy.timer

Deploy now (don't wait for the tick)

sudo systemctl start uceltic-deploy.service
Still bound by the CI smoke gate — it can only pull what CI already blessed.

Logs

Everything (pull, recreate, smoke result) goes to journald:
journalctl -u uceltic-deploy.service -f      # follow live
journalctl -u uceltic-deploy.service -n 50   # last run
A failed post-deploy smoke exits non-zero and logs
deploy.sh: post-deploy smoke FAILED ..., so the unit shows failed in
systemctl status uceltic-deploy.service.

Rollback

prod is just a moving tag. Roll it back to a known-good git sha via the
Rollback :prod GitHub Action (workflow_dispatch, input = the sha part of a
sha-XXXX tag). The timer picks up the rolled-back prod within ~2 min — the
box is never touched.

Accepted risk (ADR-0002): the next push to main re-advances prod; there
is no freeze. Roll back and revert the offending commit if you need it to stick.

Pause / resume the pipeline

sudo systemctl stop uceltic-deploy.timer       # pause polling
sudo systemctl disable --now uceltic-deploy.timer
sudo systemctl enable  --now uceltic-deploy.timer   # resume