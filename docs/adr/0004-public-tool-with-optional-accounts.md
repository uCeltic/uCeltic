# 4. Public tool with optional user accounts

- Status: Accepted; superseded in part by [ADR-0005](0005-generic-entry-notice-not-per-account-consent.md) and [ADR-0006](0006-drop-workspace-study-prompt.md)
- Date: 2026-07-09
- Deciders: Zhou Dejian
- Supersedes: parts of [ADR-0001](0001-private-vps-deployment.md) — the shared
  Basic Auth gate, the self-signed-certificate posture, and the "data not ready
  for public, anonymous exposure" rationale; and parts of
  [ADR-0003](0003-behavior-logging-for-requirements.md) — the session-only
  attribution model and the "data is anonymous" consent wording.

## Context

The advisor's requirements for the next stage (before external users test the
app in August) are: user registration and login (email + password, mandatory
email activation, no 2FA), a pre-use purpose questionnaire, continued behavior
logging, an admin backend showing which users did what, and a minimal profile
page ("some people may not want their full name shown").

Two standing decisions blocked this:

1. **ADR-0001** gated every path behind one shared HTTP Basic Auth credential at
   the Caddy layer, reasoning the manuscript data was "not ready for public,
   anonymous exposure".
2. **ADR-0003** chose `session_id`-only attribution and *rejected* per-user
   identity deliberately; the consent story promised anonymous data.

Two facts established during this analysis dissolve the blockers:

- **The corpus may be public.** The team confirmed Nina's Acallam
  semi-diplomatic editions (the real content in `backend/tei/`) can be exposed
  publicly. ADR-0001's confidentiality rationale is gone.
- **"Static site as final form" was exploratory, not decided.** The dangling
  reference to an unwritten ADR-0004 in `CONTEXT.md` recorded a possibility,
  not a commitment. The stack remains full-stack for the foreseeable project
  lifetime; a later static extraction mainly costs a browser-side search
  engine port, which is independent of accounts.

## Decision

**Access model — a public tool with optional accounts.** Anonymous visitors get
the full workspace (browse the built-in corpus, search, open local files).
Signing in adds a profile page, attribution of the holder's sessions/events,
and the pre-use questionnaire. There is **no login wall**; August study
participants are funneled *by protocol* (invitations require signing in first)
plus a dismissible in-app prompt, not by technical gating — consistent with
ADR-0003's "answer per-person questions socially" stance.

**Delete the shared gate first.** The Caddy `basic_auth` block, its env hash,
and all doc references are removed in a first PR that merges immediately —
production becomes publicly reachable before the accounts work lands, which is
accepted now that the corpus is public. `/admin` keeps Django's own staff
login; `POST /api/events/` stays open (stranger traffic is filtered at
analysis time, see below).

**Real certificate via sslip.io.** The site is served at
`https://<ip>.sslip.io` with a Let's Encrypt certificate (Caddy automates
issuance), replacing `tls internal` + raw IP. Activation emails get a clean,
clickable link with no browser warning. A paid domain remains a one-line
future swap.

**Accounts — Django's own machinery via django-allauth (headless), session
cookies.** Email + password, mandatory activation link before first login,
password reset; no 2FA, no social login. The SPA shares the origin, so
authentication is the Django session cookie: `SessionAuthentication` is
re-enabled in DRF (reversing the deliberate empty-authenticators setting) and
the client sends the CSRF token. Default API permission stays `AllowAny` —
the tool is public; only account/profile endpoints require authentication.

**Attribution — Behavior Events gain a nullable `user` FK.** The server stamps
`request.user` on each event; anonymous events keep `user = NULL`,
`session_id` stays for single-sitting reconstruction. The study cohort is
`user IS NOT NULL`; ambient anonymous traffic is retained as a secondary
signal and is naturally excluded from per-user analysis.

**Questionnaire — per-session, skippable, self-report kept apart from
behavior.** A `QuestionnaireResponse` (user, session_id, versioned question
set, answers, skipped flag) is captured by a prompt shown to signed-in users
once per session before the workspace; skips are recorded. It is *not* a
Behavior Event: it is the "said" side that the event stream's "did" side is
compared against. Question content is owned by the research team.

**Consent — re-done, because the premise changed.** The consent copy changes
from "anonymous" to: linked to your account, visible to the researcher only,
pseudonymized in any published analysis, deletable on request, destroyed after
the thesis. Advisor/ethics re-confirmation is required before August
collection begins (ADR-0003 made sign-off a precondition; its premise no
longer holds).

## Consequences

- The advisor's loop closes: stated purpose (questionnaire) ↔ observed
  behavior (events) ↔ the same person across days (account), inspectable per
  user in Django admin.
- Anonymity stance changes from "no identity exists" to "identified to the
  researcher, pseudonymized in outputs" — an ethics-narrative change, which is
  why re-confirmation is a hard gate.
- Production is publicly reachable; junk rows in `behavior_event` from
  strangers are possible and acceptable (cohort filter excludes them).
- Registration needs outbound email: an SMTP provider (Gmail app password or a
  transactional free tier) is provisioned at deploy time; only env config in
  the repo.
- The static-extraction option stays open so long as accounts remain an edge
  concern: core search/TEI services take no user parameter, and study
  facilities (questionnaire, logging, admin) stay side-channels that a static
  form simply drops.

## Rejected alternatives

- **Full login wall.** Maximally clean study data, but kills the public-tool
  ideal the corpus-is-public fact enables, adds friction for casual scholars,
  and contradicts the team's own "close the doc if you don't want it" ethos.
  Protocol + prompt gets the participants signed in without walling the tool.
- **Events without a user FK (questionnaire-only linkage).** Preserves the old
  privacy narrative but breaks cross-day attribution — the advisor's central
  ask — leaving only single-session fragments.
- **Logging only authenticated users.** Cleaner table, but discards the
  anonymous ambient signal, which is exactly the interesting usage evidence a
  public tool generates.
- **Per-user Basic Auth / shared-credential variants.** Already rejected in
  ADR-0003; no registration story, no profile, no questionnaire hook.
- **dj-rest-auth (+allauth).** The older SPA-auth combo; superseded by
  allauth's first-party headless mode — one dependency instead of two.
- **Hand-rolled registration/activation.** A few hundred lines plus the
  security details (enumeration, token expiry, resend) owned forever; the
  advisor explicitly steered toward existing Django-ecosystem machinery.
- **Buying a real domain now.** Nicer address, but sslip.io + Let's Encrypt
  delivers the trusted certificate for free today; the swap later is one line
  of Caddy config.
