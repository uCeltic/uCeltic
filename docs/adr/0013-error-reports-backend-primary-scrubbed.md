# Error Reports: a separate, backend-primary concept, scrubbed of secrets

We want failures a visitor hits — a search that 500s ("Search failed"), an auth
call that falls to the "Something went wrong" fallback — recorded so a developer
can **reproduce** them, viewable in Django admin. We decided to record them as a
new `ErrorReport` model rather than a new `BehaviorEvent` type, to capture from
both client and server with the **server as the primary source**, to record only
**unexpected** failures, and to store enough to reproduce while **scrubbing
secrets and minimising PII**.

## Considered Options

- **A twelfth `BehaviorEvent` type.** Rejected: a Behavior Event is defined
  (ADR-0003, CONTEXT.md) as an *intentional, interpretable user action* drawn
  from a **closed taxonomy**. A failure is something that happened *to* the
  visitor, not something they did. Adding it would pollute the study cohort's
  action timeline and break the closed-set invariant. A separate table joined by
  `session_id` keeps the failure's before-context without merging the concepts.

- **Client-only reporting.** Rejected: the client only ever sees `search failed:
  {status}` — it never holds the backend **traceback**, so a client-only record
  of a 500 is not reproducible. Reproducibility of backend failures lives
  server-side.

- **Server-only reporting.** Rejected: network drops, uncaught JS exceptions and
  white-screen crashes never reach the server. Only the browser witnesses them.

## Decision

- **Model.** New `ErrorReport` (analytics app), sharing `session_id` with
  `BehaviorEvent` as a best-effort join key, and stamping `user` server-side from
  `request.user` — never trusted from the client, exactly as `BehaviorEvent` does.

- **Capture point: both, backend-primary.**
  - *Backend* — a DRF exception handler (plus Django `handler500` for non-DRF
    pages) records every unhandled **5xx** with its traceback. This is the
    reproducible core, and covers the real cause of both known errors.
  - *Frontend* — records only failures it **could not handle specifically**: the
    generic `search.ts` `!res.ok` throw, the `auth.ts` non-200/401 "Something
    went wrong" fallback, `window.onerror`, unhandled promise rejections, and a
    root error boundary. Reuses the existing `log.ts` transport.

- **Boundary — what counts as an error.** Backend: **5xx only** (a 4xx is the API
  working as designed — validation, auth, rate-limit). Frontend: only the generic
  fallback branches above. Expected outcomes the UI already shows gracefully (a
  400 "email taken", a 401, a 429) are **not** recorded. This deliberately still
  catches a *bug* that surfaces as a 4xx (e.g. issue #120's sub-range 400), because
  the client throws on any `!res.ok` and lands in the fallback branch.

- **PII / secrets.** Store enough to reproduce — the search **query** and its
  parameters (already recorded on the failed `search_performed` event, so no new
  exposure), the request path and status. **Scrub passwords** before storing any
  request body. **Store no email**; identity is the `user` FK only, pseudonymised
  in admin like every study model (#69).

## Consequences

- To join a *server-side* report to a client's behaviour timeline, the request
  must carry the `session_id` (search and auth requests do not today) — otherwise
  the join is by time/user only. The report is still self-contained for
  reproduction without it.
- The admin page follows the existing `StudyDataAdminMixin` pattern: read-only,
  display-name only, no raw email/username.
