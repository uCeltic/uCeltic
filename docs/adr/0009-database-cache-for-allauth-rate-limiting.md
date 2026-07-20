# 9. Database-backed cache for allauth rate limiting

- Status: Accepted
- Date: 2026-07-20
- Deciders: Zhou Dejian

## Context

allauth throttles verification-email sends (`confirm_email`, 1 per 3 minutes
per address) through Django's cache framework. No `CACHES` setting is
configured anywhere in `backend/config/settings.py`, so Django falls back to
`LocMemCache` — an in-process cache. Production runs gunicorn with
`--workers 3` (`backend/entrypoint.sh`), so each worker keeps its own
independent 3-minute counter: the same address can get resent up to ~3x more
often than the "1 per 3 minutes" setting implies, depending on which worker
picks up the request. The throttle is real in code but not actually enforced
in production.

## Decision

Configure `CACHES` to use Django's database-backed cache
(`django.core.cache.backends.db.DatabaseCache`), backed by the Postgres
already running for the app, with a `createcachetable` migration. This makes
allauth's existing rate limiter correctly shared across all workers without
introducing any new service.

## Rejected alternatives

- **Redis.** The conventional choice for rate-limiting, but it's new
  infrastructure to provision, secure, and keep running on a VPS that
  currently has none — overkill for a limiter this low-volume (one counter
  per email address, touched a handful of times per verification flow).
- **Filesystem cache.** Shared across processes on the same host, so it would
  also fix the bug, but it's slower than the database cache and buys nothing
  extra here: the project has no multi-host deployment to worry about either
  way.

## Consequences

- Every rate-limit check becomes a DB round trip instead of an in-memory
  lookup — acceptable given the volume involved.
- Deploy needs a one-time `python manage.py createcachetable` migration step.
