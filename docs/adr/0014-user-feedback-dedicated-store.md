# 14. User Feedback goes to a dedicated store, not the behavior-event stream or GitHub

- Status: Accepted
- Date: 2026-07-24
- Deciders: Zhou Dejian

## Context

The workspace needs an always-available way for any visitor — guest or
signed-in — to send the team a bug report, a feature request, or a general
remark, from a floating button that never hides (unlike the responsive toolbar,
ADR-0011, which folds controls into a hamburger at narrow widths).

Feedback is **human-written prose a person will read and triage**, which sets it
apart from the two capture concepts already in the app: a Behavior Event is a
closed-taxonomy *intent* the visitor performed (ADR-0003), and an Error Report is
an automatically-captured *failure* that happened to them (ADR-0013). Feedback is
neither — it is a deliberate, free-text *message*.

## Decision

Store Feedback in its **own `Feedback` table** behind `POST /api/feedback/`
(`AllowAny`, anonymous allowed, `user` stamped server-side from `request.user`),
viewed read-only in Django admin — mirroring the QuestionnaireResponse pattern.
Fields: `category` (closed set `bug` / `feature` / `other`, default `other`),
`body` (required prose), `contact` (optional free text, for anonymous submitters
who want a reply), `context` (a `JSONField` snapshot — open documents, scope,
viewport, URL — so a bug report is reproducible without the user describing their
screen), plus the usual `session_id` / `user` / `app_version` / `created_at`.

On success the client **also** emits a `feedback_submitted` Behavior Event
carrying only `{ category }` — the reserved-but-unused taxonomy member finally
gets a producer — so the study timeline records *that* feedback was sent without
the prose ever entering the study pipeline.

## Considered options

- **Fold it into `BehaviorEvent` (`feedback_submitted` payload).** Rejected: puts
  free-text, potentially PII-bearing prose into the closed-taxonomy study stream
  and gives the team no structured surface to triage. We keep the *signal* there
  (the `{ category }` event) but not the *content*.
- **Open a GitHub issue directly.** Rejected: this is a public tool (ADR-0004);
  anonymous submissions would flood the tracker with `needs-triage` noise, and the
  backend would have to hold a GitHub write token. Too much blast radius for a
  niche academic tool.

## Consequences

- **No rate limiting this round.** Sibling endpoints (`/events/`,
  `/questionnaire/`) are unthrottled `AllowAny`, and feedback volume is tiny.
  Abuse is fended off cheaply — serializer `max_length` guards and a submit button
  disabled while in flight — not with a throttle. A DRF `ScopedRateThrottle` over
  the ADR-0009 database cache is the escape hatch if it ever becomes a problem,
  but that pulls in a correctness-critical `NUM_PROXIES` setting (the app sits
  behind one Caddy hop that appends `X-Forwarded-For`), so it is deferred until a
  real need justifies it.
- **`context` is tool-usage state, not PII.** Which documents are open and the
  current scope are the same kind of thing `BehaviorEvent.payload` already
  records; the only user-authored content is what the visitor types into `body` /
  `contact`.
