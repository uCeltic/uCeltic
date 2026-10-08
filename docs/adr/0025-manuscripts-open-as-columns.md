# 25. Manuscripts open as Columns, not in a side panel

- Status: Accepted
- Date: 2026-10-07
- Deciders: Zhou Dejian

## Context

A Manuscript was shown in one IIIF side panel, switched on and off from the
toolbar, with a `<select>` inside it choosing which of the three books to show.
So only one Manuscript could be on screen at a time, and it could never sit next
to the Version it was being compared against — the panel was always at the
right-hand edge, whatever order the text Columns were dragged into.

Because the panel had a fixed share of the width, ADR-0011 hid it below `lg`
(1024px) so it would not crush the text Columns, and #160 disabled the toolbar
toggle there.

## Decision

**A Manuscript opens as a Column in the same strip as the Documents.**

- The toolbar's `Manuscripts` control becomes an opener like `Works`: a flat
  list to tick, then *Open selected*; an open Manuscript is marked `open`.
- One book per Column, open at most once; the in-panel `<select>` goes. None is
  open on load.
- Manuscript and Document Columns share the one eight-Column cap.
- A Manuscript Column is outside search, the Tag Filter and Search History, and
  carries no `Reading only` chip.
- **The auto-hide below `lg` is removed.** A Manuscript Column follows
  ADR-0019 — `min-width` and a sideways-scrolling strip — like every other
  Column, and the toolbar control is usable at every width.
- `iiif_toggled` is retired: the client stops sending it, but it stays a legal
  backend `event_type` so the rows already recorded remain valid study data.
  `manuscript_opened` / `manuscript_closed` (`{manuscript_id, label}`) are
  added, not folded into `document_opened`. Page turns and zooms are not
  logged.

## Consequences

- Supersedes ADR-0011's "narrower still → the IIIF Manuscript panel
  auto-hides" and the #160 disabled-toggle update to it.
- The Manuscripts toolbar label still collapses first (ADR-0020); its icon now
  stands beside the Works opener's ▾ rather than on a pressed toggle.
- The list stays the three hard-coded Manuscripts; declaring them in the
  database is separate work, as is linking a Version to the Manuscript it
  transcribes.

## Rejected alternatives

- **Keep the side panel, with tabs or panes for several Manuscripts.** Still
  pins every Manuscript to the right edge, away from the Version it matches,
  and keeps the auto-hide.
- **One cap per kind.** The cap exists for the strip's width, which does not
  depend on what a Column holds.
