# 23. Pause the pre-use questionnaire until it has a question set

- Status: Accepted
- Date: 2026-08-18
- Deciders: Zhou Dejian
- Amends: [ADR-0007](0007-questionnaire-for-guests-and-idle-session-expiry.md) —
  its decision that the questionnaire shows to **every visitor, guest or
  signed-in**, still stands and is not reversed. What changes is that the
  workspace currently asks *nobody*, because there is nothing worth asking.

## Context

The pre-use questionnaire has carried a single placeholder question since it was
built ("What is your main purpose using these manuscripts this time?"). The
content swap that the 2026-07-09 team meeting was meant to produce never
happened, and the question set is owned by the research team, not by this
codebase.

ADR-0007 opened the questionnaire to guests specifically so the mid-August 2026
workshop would yield a broader pool of "said" data. That reasoning assumed a
question set existed to ask. A one-box prompt cannot deliver the "said" side of
the said/did comparison the instrument exists for: asking it at the workshop
costs every attendee a blocking modal on entry and returns nothing worth
analysing.

## Decision

**The workspace stops rendering the questionnaire.** `WorkspaceLayout` no longer
mounts `QuestionnaireModal`, so no visitor — guest or signed-in — is prompted on
entry.

**This is a pause, not a removal.** Everything behind the overlay stays exactly
where it is:

- `QuestionnaireModal` and its own tests
- `authStore`'s questionnaire state, including the 6-hour idle reset from
  ADR-0007
- the backend `QuestionnaireResponse` model, its migration, and
  `GET`/`POST /api/questionnaire/`

**The condition for restoring it is a real question set** — a versioned set of
questions from the research team that the said/did comparison can actually be
run against. When that exists, restoring the instrument is adding
`<QuestionnaireModal />` back to `WorkspaceLayout`; nothing else has to be
rebuilt.

**A layout-level test asserts the absence**, with `QuestionnaireModal` left
unmocked, so an accidentally re-added render site fails CI rather than surfacing
in front of a room of workshop attendees.

## Consequences

- `CONTEXT.md`'s **Questionnaire Response** entry no longer describes an
  instrument that runs on every visit; it records that the workspace does not
  currently ask, and points here.
- No Questionnaire Responses are collected while the pause holds — including
  skips, so the denominator stops too. Rows already recorded are untouched.
- ADR-0007's guests-too decision is dormant, not withdrawn. A reader who finds a
  fully built, fully tested component that nothing renders should land here.
- The **Feedback** button is not a substitute and must not be described as one
  (see CONTEXT.md): the questionnaire is prompted, records a skip, and therefore
  has a denominator; Feedback is visitor-initiated, self-selected, and captures
  evaluation rather than intent.

## Rejected alternatives

- **Delete the questionnaire outright** (component, store state, model,
  endpoints, migration). Rejected: the instrument is wanted, only its content is
  missing. Deleting would throw away working, tested code and the recorded
  responses' schema, and make restoration a rebuild rather than one line.
- **Ship the placeholder question at the workshop anyway.** Rejected: it blocks
  every attendee on entry and yields nothing analysable — the cost is real and
  the return is zero.
- **Write a question set here, now, to keep the instrument live.** Rejected: the
  question set is the research team's to own (CONTEXT.md → Questionnaire
  Response). Inventing one in the codebase would produce data nobody agreed to
  the meaning of.
