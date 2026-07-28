# 10. Drop the three-state workspace Mode switcher in favour of a Tag Filter

- Status: Accepted; the Tag Filter it introduced was reshaped by #147, and the
  toolbar it describes was merged further by #152 — see the
  Update below and CONTEXT.md → Tag Filter
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

## Update (2026-07-28, #147)

The shell was wired, and the vocabulary above did not survive contact with the
corpus. A multi-select over the six named-entity *elements* offered four options
that occur only in sample files or not at all, and the two real ones
(`persName`, `placeName`) matched hundreds of names indiscriminately. The
research manuscripts carry their own **Authority List** in `standOff`, which is
a better answer to the same question: the control is now a single-select over
the people and places the open documents declare, with per-column highlighting
and navigation of one entity's occurrences. The toolbar slot and the reasoning
for reusing it are unchanged; only what the menu is a menu *of* changed.

`tag_entity_selected` was added to the closed taxonomy at the same time
([ADR-0003](0003-behavior-logging-for-requirements.md)) — the wired control has
a signal worth recording, which the shell did not.

## Update (2026-07-28, #152)

The other two controls this ADR left standing — `All Works` and `Open TEI` —
were merged into one work → manuscripts opener, and with them went the claim
that a Work is a search scope; see
[ADR-0015](0015-search-scope-is-the-open-documents.md). The Tag Filter keeps
both its slot and its behaviour, with one addition: while a work is chosen, its
menu is built from that work's open columns only.
