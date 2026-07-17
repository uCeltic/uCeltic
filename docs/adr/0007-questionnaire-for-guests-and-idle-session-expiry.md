# 7. Questionnaire for guests, and idle-based session expiry

- Status: Accepted
- Date: 2026-07-16
- Deciders: Zhou Dejian
- Amends: [ADR-0004](0004-public-tool-with-optional-accounts.md) — the pre-use
  questionnaire was "captured by a prompt shown to signed-in users once per
  session before the workspace"; it now shows to every visitor, guest or
  signed-in. Also amends: [ADR-0003](0003-behavior-logging-for-requirements.md) —
  "Each continuous sitting gets a random uuid generated on app load," with no
  further boundary rule; a session can now also end from inactivity.

## Context

A workshop is planned for roughly a month out (mid-August 2026), where
attendees will try the app live during a presentation — mostly as guests, not
signed-in study participants. The owner wants their stated purpose captured
too, for the same reason `BehaviorEvent` already accepts anonymous traffic
(ADR-0004): a broader pool of "said" data to mine for requirements, not just
the invited cohort.

Two gaps blocked this:

1. **The questionnaire was signed-in-only.** `QuestionnaireResponse.user` is a
   required FK, `QuestionnaireView` requires `IsAuthenticated`, and the client
   (`authStore.shouldShowQuestionnaire`) never prompts an anonymous visitor
   (#67). Unlike `BehaviorEvent`, which already has a nullable `user` and
   accepts anonymous events, the questionnaire had no anonymous path at all.
2. **"Session" had no time boundary.** ADR-0003 defined a Session as "a random
   uuid generated on app load" — the client only ever mints a new one on a
   full page load. A tab left open for hours (e.g. the workshop's live demo)
   stays one session indefinitely, so the questionnaire's "once per session"
   framing doesn't match the owner's intent: a visitor returning after a long
   gap is doing a new visit with a new purpose, not continuing the old one.

## Decision

**The questionnaire shows to every visitor, guest or signed-in**, once per
session, before the workspace — the `status === "authenticated"` gate in
`shouldShowQuestionnaire` is removed. Skip remains always available and is
itself a recorded answer, unchanged from ADR-0004.

**`QuestionnaireResponse.user` becomes nullable**, mirroring `BehaviorEvent`:
anonymous responses are recorded with `user = NULL`, attributed responses
keep the FK. `QuestionnaireView`'s permission changes from `IsAuthenticated`
to open access, setting `user = request.user if request.user.is_authenticated
else None` — the same pattern `EventView` already uses.

**A Session now also ends after 6 hours of inactivity**, not only on a fresh
app load. The client tracks the timestamp of the last logged activity
in-memory; the next action past a 6-hour gap gets a freshly generated
`session_id` and, if applicable, the questionnaire is shown again. This is
purely additive to the existing "new app load → new session" rule — a page
reload still always starts a new session as it does today; the idle check
only covers a tab left open without reloading. No persistence (e.g.
`sessionStorage`) is needed for this: an unreloaded tab keeps its in-memory
clock, and a reload already resets everything today regardless.

**Sign-in and sign-out keep forcing a new session independently.** This
predates and is unrelated to the idle rule — both apply, whichever triggers
first. A guest who answers the questionnaire and then signs in within the
6-hour window is prompted again, same as today.

**No Entry Notice copy change.** ADR-0005's banner text ("...such as searches
performed, documents opened, and settings changed") already uses "such as" —
non-exhaustive — and a questionnaire response is reasonably read as covered
by "your activity." Reopening ADR-0005's specific wording is out of scope
here.

## Consequences

- `CONTEXT.md`'s **Session** entry needs its "generated on app load" line
  extended with the 6-hour idle rule.
- `CONTEXT.md`'s **Questionnaire Response** entry needs "a **signed-in
  User's** self-stated purpose" corrected — it's now any visitor's, matching
  the "may belong to a User (signed in) or be anonymous" language already
  used for Session/BehaviorEvent.
- `client/src/store/authStore.test.ts` and any `QuestionnaireModal`/session
  tests need updating for the new anonymous-visible behavior and the idle
  boundary.
- Admin (`backend/apps/analytics/admin.py`) needs no change — `user_display`
  and `UserListFilter` already handle a nullable `user` generically (built
  that way for `BehaviorEvent` already).
- A migration is required for `QuestionnaireResponse.user` (`null=True`).

## Rejected alternatives

- **Redefine Session as strictly time-boxed only** (drop the "new app load →
  new session" rule, rely solely on the idle timer). Rejected: unnecessary
  behavior change to the common case (closing/reopening the app already
  reads as a new visit); the idle timer only needs to cover the gap case of a
  long-lived tab.
- **Persist the idle clock in `sessionStorage`** so a session could survive a
  reload within the 6-hour window. Rejected: reload-starts-a-new-session is
  existing, accepted behavior (ADR-0003) and not something this decision was
  asked to change; adding persistence here would silently alter it.
- **Drop the sign-in/sign-out session reset now that idle expiry exists.**
  Rejected: the two rules serve different purposes and the owner wants both
  kept — an identity change is its own reason to treat it as a fresh sitting,
  independent of how long it's been.
- **Update Entry Notice's copy to name the questionnaire explicitly.**
  Rejected: the existing non-exhaustive wording already covers it; no stated
  need to reopen ADR-0005.
