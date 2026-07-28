# 3. Behavior logging to discover requirements from real usage

- Status: Accepted; superseded in part by
  [ADR-0004](0004-public-tool-with-optional-accounts.md) — session-only
  attribution and the "data is anonymous" consent wording; and by
  [ADR-0007](0007-questionnaire-for-guests-and-idle-session-expiry.md) — a
  Session now also ends after 6 hours of inactivity, not only on app load.
  Extended 2026-07-28 with `tag_entity_selected` (see below), taking the
  taxonomy to 12 event types
- Date: 2026-07-06
- Deciders: Zhou Dejian

## Context

The software's requirements are under-specified: we don't have a confident list of
what functionality to build next, nor quantified quality targets. The advisor's
suggestion is to **learn requirements from real usage** rather than guess them —
instrument the app, observe how it is actually used, and mine both functional (FR)
and non-functional (NFR) requirements from the resulting record.

Two constraints shape everything:

1. **Tiny, known user base.** The only real users are the **4-person research team
   itself**. That is far too few for classic analytics, but it is enough for a
   qualitative, evidence-backed study — and, crucially, we can *ask the users
   directly* whenever the data is ambiguous.
2. **No authentication.** The app enforces *no login by design* (see
   [ADR-0001](0001-private-vps-deployment.md); access is a single shared HTTP Basic
   Auth credential). So the server cannot natively tell *who* did something, or even
   that two sittings are the same person.

The logs are explicitly a **corroborating instrument, not the primary one**. With
N=4, direct observation, an in-app feedback control, and a diary thread carry the
"why"; the logs quantify and timestamp the "what".

## Decision

**Method — a triangulation study, not analytics.** Three sources, cross-checked:
passive behavior logging (the "what", always-on, main quantitative source),
in-app micro-feedback at friction points (the "why", captured in the moment), and a
shared diary thread (the "why", captured after the fact). A requirement is only
"confirmed" when the log pattern and at least one qualitative source agree.

**Unit of attribution — `session_id` only.** Each continuous sitting gets a random
uuid generated on app load. There is deliberately **no cross-day identity, no device
id, no name**. This is enough to reconstruct each sitting's sequence
(searched → tweaked a param → gave up), which is what requirement-mining needs.
"Is the same person hitting this repeatedly across days?" is answered *socially*
(ask the 4 people), not from the data.

**What is recorded — ~12 semantic events, not raw interaction.** A closed taxonomy
of meaningful actions (`search_performed`, `search_param_changed`, `result_navigated`,
`document_opened`/`_closed`, `mode_changed`, `iiif_toggled`, `font_size_changed`,
`scope_changed`, `tag_entity_selected`, `feedback_submitted`, `session_started`).
Anything not in the set is not logged. Each event maps to one interpretable intent.
NFR signal (`latency_ms`, `result_count`, `error`) rides along on the events that
produce it.

`tag_entity_selected` (added 2026-07-28, #147) carries `{entity_id}` — the
Authority List id of the person or place the reader chose to follow, `null` when
they stopped following anyone. It was added when the Tag Filter stopped being a
shell: *which people and places a reader singles out, and in which manuscripts*
is a first-class requirement signal for a project whose subject is the Acallam's
cast, and it is not recoverable from any other event. The taxonomy is closed, not
frozen — adding a type is a deliberate, documented act, and this is the first
since the original set.

**Architecture — self-built, reusing the existing Django + Postgres.** A client-side
emitter POSTs to a new `POST /api/events/` endpoint in a new `apps/analytics` Django
app, which validates the event type against the allowed set and writes one row to a
`behavior_event` table. No third-party analytics service, no new infrastructure.

**Table shape — thin envelope + JSON payload.** Fixed columns for the metadata every
event shares (`id`, `session_id`, `event_type`, `client_ts`, `server_ts`,
`app_version`), plus a single `payload` JSONField for event-specific fields. Both
timestamps are kept: `client_ts` (when the action actually happened) for ordering and
think-time, `server_ts` (server-stamped) as a tamper-resistant fallback.
`app_version` lets us separate behavior *before* and *after* a change to the app.

**Transport — immediate fire-and-forget, fail-silent, never blocking the UI.** Each
event is sent as it happens; failures are dropped silently (no retry, no error, no
`await` on the main flow). At this volume batching is unnecessary, and immediate send
sidesteps the "lost queued events on tab close" problem. *Logging must never slow or
break a user action.*

**Privacy — full query text, with informed consent.** The raw `query` string is
stored (it is the single strongest FR signal — what users search for and how they
spell it). This is gated on: up-front informed consent from the 4 members (they are
shown the exact event list and told data is anonymous, researcher-only, deletable on
request, and destroyed after the thesis), access restricted to the researcher, and
**ethics-board / advisor sign-off obtained before collection begins**.

**Analysis — descriptive statistics + diary triangulation, each requirement traced
to evidence.** No heavy modeling: counts, funnels, failed-search lists, latency
distributions. Every requirement written into the thesis carries its log evidence
plus a corroborating qualitative source.

## Consequences

- The requirement catalog is *traceable*: each FR/NFR points to concrete log evidence
  (e.g. "20+ zero-result searches on `Fionn`/`Find`") plus a diary/feedback quote.
- Adding a new event type never migrates the table (payload is JSON); the trade-off is
  slightly uglier SQL (`payload->>'field'` with casts) and no DB-level type safety.
- Anonymity here is *social comfort + ethics simplicity*, not strong protection — with
  N=4, re-identification is trivial. Real protection comes from **what** is logged and
  **who** can see it, not from the absent identity column.
- `session_id`-only means cross-day, per-person questions are unanswerable from the
  data by design; they are delegated to the 4-person social channel.

## Rejected alternatives

- **Third-party analytics (PostHog / Plausible / Umami).** Session replay and funnels
  are overkill for N=4 and ~12 semantic events; PostHog adds containers (incl.
  ClickHouse) and a privacy surface; page-view tools handle parameterized semantic
  events poorly. A black box also can't be *described and owned* as a thesis
  contribution the way a self-designed schema can.
- **Persistent device id (localStorage uuid).** An unreliable proxy for a person
  (multi-device fragments one user; cache-clear/incognito loses them) that *also*
  gives a false sense of anonymity. Rejected in favor of honest `session_id`-only.
- **Per-participant codes / links (`?p=…`) or per-user Basic Auth.** Would give
  reliable cross-day, per-person tracking, but the team chose anonymity, and
  per-person linking isn't needed for requirement mining at N=4.
- **Raw interaction logging (every click/scroll/keystroke).** ~40× the volume,
  drowns the signal, enlarges the privacy surface, and is unreadable — no payoff at
  this scale.
- **Wide table (one column per field).** Type-safe and cleaner SQL, but mostly-NULL
  and forces a schema migration every time an event gains a field.
- **Not logging query text (counts/length only).** Safest, but cripples the strongest
  FR signal ("what did they search that returned nothing?"). Covered by consent
  instead.
- **Server-side-only logging (Django middleware on API calls).** Misses the
  client-only actions (mode switch, IIIF toggle, font size, slider drags, result
  navigation) that carry much of the usability signal.
