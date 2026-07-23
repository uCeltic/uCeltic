# 10. Drop the three-state workspace Mode switcher in favour of a Tag Filter

- Status: Accepted
- Date: 2026-07-21
- Deciders: Zhou Dejian

## Context

The workspace toolbar carried a Mode switcher (`Search` / `People & Places` /
`Personal`) that was **dead state**: `workspaceStore.mode` had exactly one
reader (`ModeButton`), no panel or search path consumed it, and its only side
effect was emitting a `mode_changed` behavior event. Sitting next to the real
search bar, its `Search ▾` label read as a confusing "second search".

## Decision

**Remove** it — the type, the store field, the button — and reuse its toolbar
slot for a **Tag Filter** (multi-select over the six TEI named-entity tag types;
see CONTEXT.md). Rationale (from the 2026-07-21 supervision meeting): the modes
were never finished and "not very necessary anymore — we can integrate the
second mode into the search"; a filter over predefined tag names is what that
slot actually wants.

## Consequences

- `mode_changed` becomes a **dead member of the closed behavior-event taxonomy**
  ([ADR-0003](0003-behavior-logging-for-requirements.md)). Leave the enum value
  in place (client `api/log.ts` and server `apps/analytics/models.py`) so
  historical rows stay decodable; just stop emitting it. A future reader who
  finds `mode_changed` with no Mode UI should land here.
- The Tag Filter ships as a **UI shell only** this round — its functional wiring
  (restrict search vs. restrict highlighting) is intentionally deferred.
