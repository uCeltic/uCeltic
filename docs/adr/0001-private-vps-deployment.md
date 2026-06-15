# 1. Private VPS deployment behind Caddy + Basic Auth

- Status: Accepted
- Date: 2026-06-15
- Deciders: Zhou Dejian

## Context

We need a reachable running instance of the uCeltic stack for collaborators and
reviewers, but the manuscript data and the unauthenticated `/api` + `/admin`
surface are not ready for public, anonymous exposure. The application layer (#6)
ships with **no authentication by design**; the access gate is added at deploy
time. We have an already-provisioned 4-core / 4 GB CentOS VPS reached by raw IP
(no domain name).

## Decision

Deploy the #6 Docker Compose stack **privately** on the self-managed CentOS VPS,
fronted by a Caddy reverse proxy that:

- serves HTTPS with a **self-signed certificate** (`tls internal`), since the box
is reached by IP and cannot obtain a public ACME certificate; visitors accept a
one-time browser warning;
- enforces **HTTP Basic Auth on every path** (frontend, `/api`, `/admin`) so only
holders of a shared credential get in; unauthenticated requests receive `401`.

Secrets (`SECRET_KEY`, `DB_PASSWORD`) and the Basic Auth **bcrypt hash** live only
in the VPS `.env` (never committed). PostgreSQL is never published to the host; it
is reachable only inside the Compose network. The host firewall (`firewalld`)
allows only 22, 80 (redirect) and 443.

We explicitly reject:

- **A PaaS (Render/Fly/Railway/…)** — we already have the VPS, want full control of
data residency, and avoid per-service cost and vendor lock-in.
- **A public, anonymous demo** — the data/API are not ready for open exposure;
that is tracked as a separate issue and is out of scope here.

## Consequences

- Reaching the app requires the shared Basic Auth credential and accepting a
self-signed TLS warning (no green padlock, no domain).
- Rotating the credential = regenerate the bcrypt hash, update `.env`, restart.
- This is a human-driven deploy: a person provisions the box and holds the
production secrets; it is not an unattended agent task.
- If we later want a public demo or a real domain + trusted certificate, that is a
new decision (likely superseding parts of this ADR).