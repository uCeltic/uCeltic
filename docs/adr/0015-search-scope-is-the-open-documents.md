# 15. Search scope is the open documents; a Work only opens them

- Status: Accepted
- Date: 2026-07-28
- Deciders: Zhou Dejian

## Context

The toolbar carried two controls that were really one question asked twice.
`All Works` was a multi-select over three **hard-coded, fictional** works
(`the_finn_cycle`, `tain`, `saltair`) whose ids named nothing in the database —
and which omitted *Acallam na Senórach*, the work every research manuscript in
`backend/tei/` belongs to. `Open TEI` was a flat list of every document in the
catalogue, ungrouped, one click one document. So the reader chose a work that
meant nothing, then opened documents from an unrelated list.

Merging them (#152) forced a decision that had been deferred since the domain
model was written: CONTEXT.md → Work declared **search scope is a Work**, while
`selectedWorkIds` had exactly one reader — a `scope_changed` log line. Search
has always in fact run over the visible TEI columns
(`getSearchableDocuments`), and always did so regardless of the scope control.
The merged control means *what to open*, which is not the same claim.

## Decision

**Search scope is the documents currently open.** A Work is an **opener**: it
groups the catalogue into work → its Versions, and the reader ticks which
witnesses to put on screen. Nothing filters search by work.

The Work→Document relationship moves into the database (`apps.tei.Work` plus a
nullable FK on `TEIDocument`, nested into the existing `/api/tei/` responses).
`workspaceStore.selectedWorkId` replaces `selectedWorkIds`: single-select, a
real database id, and the one thing it does besides driving the menu is narrow
the Tag Filter to that work's entries (#147) — a one-way link, work → entities.

## Consequences

- The documented scope semantics change; CONTEXT.md → Work is rewritten to match.
  What the code does does **not** change: search already ran over the open
  columns, so this records reality rather than altering behaviour.
- One less concept for the reader: the columns on screen are the scope, which is
  what people assumed from looking at them.
- `scope_changed` stays in the closed taxonomy (ADR-0003) with its
  `selected_work_ids` payload, now carrying at most one database id. It records
  which work is being read, not what is searched — historical rows keep meaning
  roughly what they did, which is more than dropping the event would give us.
- [ADR-0010](0010-drop-workspace-mode-switcher.md)'s toolbar arrangement is
  unaffected in shape: the Tag Filter keeps its slot, and the merged opener takes
  the two slots that `All Works` and `Open TEI` held.
- Because the menu is grouped from the document catalogue, a work with no
  documents cannot be rendered at all — the acceptance criterion is met by
  construction rather than by a filter someone must remember to keep.
- `MAX_OPEN_DOCUMENTS` (8) now has to be answered for a *batch*: `planTEIOpen`
  decides before the first fetch how many fit, opens those, and reports
  "Opened 3 of 5 — close a column to open more" in the status bar. The `alert()`
  the old picker used is gone.

## Considered options

- **Keep Work as a search filter and wire it up properly.** Rejected: it would
  add a second, invisible reason a visible column returns no results — the
  column is on screen, was searched, and matched nothing *because of a menu
  elsewhere*. The open columns are already the honest answer.
- **Derive the work from the document title.** Rejected in #152: titles embed
  the work name today (*Laud Misc. 610 — Acallam na Senórach, ll. 2400–3106*),
  but the first differently-titled upload would silently fall out of its work —
  the same hard-coded-fiction failure in a new costume.
- **A new `GET /api/works/` nesting its documents.** Rejected: one more endpoint
  and serializer to keep in step, when the frontend can group the one catalogue
  response it already fetches. The nesting would also make empty works
  representable, which we would then have to filter back out.
