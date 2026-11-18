# VPS runbook — pull-based CD (issue #38)

Operational companion to [docs/cd-pipeline.md](cd-pipeline.md) and
[ADR-0002](adr/0002-automated-cd-pull-based.md). The box never builds: a systemd
timer pulls the blessed `:prod` images every ~2 min and recreates the stack.

Assumes the repo is checked out at `/opt/uceltic` with a real `.env`
(from `.env.example`).

## URL scheme (#63, #215)

The site is served at `https://uceltic.com` (registrar: Spaceship). Its DNS has
two `A` records, `@` and `www`, both pointing at the VPS. Caddy auto-issues a
Let's Encrypt certificate for each site address in `Caddyfile.prod` (ACME
HTTP-01 on port 80, which is already open in firewalld), so browsers get a
trusted cert with no warning.

Two other addresses redirect permanently to `https://uceltic.com`, path and
query kept:

- `www.uceltic.com`;
- `https://<SERVER_IP>.sslip.io`, the address the site was first published at.
  [sslip.io](https://sslip.io) resolves `<ip>.sslip.io` to `<ip>` with no DNS
  setup, so links sent out before the domain existed keep working.

Raw-IP URLs (`https://<ip>`) do not serve TLS.

The `.env` on the box must carry the domain too. `SERVER_IP` stays: Caddy
builds the sslip.io redirect from it.

```sh
SERVER_IP=<vps-ip>
ALLOWED_HOSTS=uceltic.com                # plus any local entries
CSRF_TRUSTED_ORIGINS=https://uceltic.com
```

Certs live in the `caddydata` volume; don't wipe it casually or Caddy
re-issues on next boot (Let's Encrypt rate-limits issuance).

## Outbound mail for account activation (#64)

Registration is worthless without email: allauth mails an activation link and the
account cannot sign in until it is clicked. The box `.env` therefore needs an SMTP
sender and the SPA's public address:

```sh
FRONTEND_BASE_URL=https://uceltic.com         # the activation link is built from this
EMAIL_HOST=smtp.gmail.com                     # or smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_HOST_USER=<sender>
EMAIL_HOST_PASSWORD=<app password / SMTP key>  # Gmail: an app password, not the login one
DEFAULT_FROM_EMAIL=uCeltic <no-reply@...>
```

With `EMAIL_HOST` blank Django falls back to the console backend and the mail is
written to the container log instead of being delivered — which looks like a working
deploy until someone tries to register. After setting these, recreate the stack and
check delivery with a throwaway registration.

**Changing the site address.** This takes more than CD, because the box runs
`Caddyfile.prod` and `deploy.sh` from its checkout at `/opt/uceltic`, and the
timer pulls images only. Do the steps in this order. If Caddy redirects to a
name that doesn't resolve yet, every visitor on an old link lands on a dead
address.

1. Point the new name's `A` record(s) at the VPS, and wait until
   `dig +short <name>` returns the VPS IP.
2. Merge the change to `Caddyfile.prod` (and `deploy.sh`'s `SMOKE_URL` default).
3. In the box `.env`, update `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` and
   `FRONTEND_BASE_URL`.
4. On the box, pull the checkout and recreate the two services that read the
   changed files:

   ```sh
   cd /opt/uceltic && git pull
   sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml \
     up -d --force-recreate backend web
   ```

5. Check the new address, the redirects, and an activation email from a
   throwaway registration.

## After a TEI parser change: `reparse_tei` (#151)

`parse_tei` runs from a `post_save` signal, so a document is parsed **once**, when
it is uploaded. `entrypoint.sh` runs `migrate`, not the parser — a parser fix
therefore reaches new uploads only, and the corpus already on the box keeps the
`parsed_json`, `anchors` and `word_array` produced by the parser of the day. The
symptom is a fix that passes every test and changes nothing you can see in prod.

After deploying a change to `apps/tei/services/parse.py`, re-parse the stored
corpus by hand:

```sh
sudo docker compose -f docker-compose.prod.yml exec backend \
  python manage.py reparse_tei
```

It re-saves every document, prints each one's new word count, and leaves the old
parse in place for any file that fails to parse.

## After a corpus change: swap the documents, then `reparse_tei` (#162)

`backend/tei/` in the repo is the **archive** of the built-in corpus. It is not
loaded by anything: `MEDIA_ROOT` is `backend/media/`, kept in a Docker volume,
and the rows the app serves got there through the admin's upload form. Changing
the files in the repo therefore changes nothing in prod on its own — the swap is
a manual step, and the shipped files are what it is done *from*.

When a re-cut corpus lands (as in #162, where four Acallam
witnesses replaced three ll. 2400–3106 ones):

1. In `/admin/tei/teidocument/`, upload each new file and **assign its Work** in
   the same form. The Work is never inferred from the title (#152), so a
   document uploaded without one silently leaves its Work's branch in the
   opener.
2. Delete the superseded documents. Deleting is safe for the Work itself —
   `TEIDocument.work` is `SET_NULL`, so the Work survives losing its documents.
3. Re-parse, for the same reason as after a parser change — a freshly uploaded
   document is parsed by the signal, but any document already on the box is not:

   ```sh
   sudo docker compose -f docker-compose.prod.yml exec backend \
     python manage.py reparse_tei
   ```

4. Check the swap from the workspace, not from the admin: open the new documents
   side by side, confirm each renders and returns search results, and confirm
   they are grouped under the right Work in the `Works` opener.

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