# 19. Columns keep a minimum width and the strip scrolls sideways

- Status: Accepted
- Date: 2026-08-05
- Deciders: Zhou Dejian

## Context

Extends [ADR-0011](0011-desktop-only-responsive-scope.md) from the tool bar to
the document area below it.

Open text viewers split the document area evenly with no lower bound, up to
eight of them. Each column was `flex-1 min-w-0`, so the only thing setting a
column's width was how many were open and how wide the window was. Shrink the
window — or put the browser in a vertical split screen, which is how two
manuscripts get compared against a PDF — and the columns went on dividing what
was left until each one was narrower than its own controls:

- the header's close (**✕**) slid under the next column and could not be
  clicked, so a column could not be closed to make room for the others;
- the result card's **←/→** were pushed out of view, so the results a search had
  just found could not be stepped through.

Both failures are self-defeating: the controls that go first are the two that
would let the user recover from the crowding.

## Decision

**A column has a floor, and the strip scrolls rather than breaching it.**

- Every column carries `min-width: 320px` (`COLUMN_MIN_WIDTH_PX` in
  `client/src/workspace/responsive.ts`). It keeps `flex-1`, so while the columns
  all fit they still divide the area evenly and nothing about a wide desktop
  changes.
- The column strip is `overflow-x: auto`. Once the columns stop fitting, the
  strip scrolls horizontally — native scrolling, no JS.
- Vertical overflow on the strip is pinned off (`overflow-y: hidden`). Each
  column already scrolls its own text; `overflow-x: auto` alone computes
  `overflow-y` to `auto` as well, which would put a second scrollbar around the
  columns.
- Inside a column, the controls that must survive the floor say so:
  the ✕ and the result card's ←/→ are `shrink-0`, and the line/score metadata
  beside them truncates instead. The floor is the primary guarantee; these keep
  the failure mode graceful if a column ever lands at exactly the minimum.

The single value lives in `responsive.ts` and is applied as an inline
`min-width`, so the layout, the tests and this document all name the same
number. 320px is a judgement, not a measurement: roughly 240px of it is what a
column's own controls occupy, and the rest is the margin that keeps the text
under them worth reading.

## Consequences

- Below roughly `320px × column count` the workspace gains a horizontal
  scrollbar. That is the trade being bought: scrolling to a column is worse than
  seeing all of them, and better than seeing all of them and being able to
  operate none.
- Nothing measures anything. There is no `ResizeObserver`, no breakpoint, and no
  column count at which behaviour changes — the same rule holds at every width,
  which is why it needs no test matrix of viewport sizes.
- Drag-to-reorder is unaffected, and gains auto-scroll: `@dnd-kit`'s pointer
  sensor sets `autoScrollEnabled`, so a drag toward the edge scrolls the nearest
  scrollable ancestor — which is now this strip. That is the library's own
  behaviour, exercised in a browser rather than by a test: jsdom lays nothing
  out, so a real drag cannot be simulated there. The suite covers the reorder's
  outcome (`computeDragEndReorder`, and the order the strip renders in), not the
  gesture.
- **The floating select-to-search button needed no change.** It positions itself
  in viewport coordinates and re-measures on any scroll event in the capture
  phase, so a horizontal strip scroll moves it exactly as a column's own
  vertical scroll already did. A test now pins that.
- **The note panel's clipping had to be taught the second axis.** A `fixed`
  panel closes when its marker scrolls out of the box that clips it (#166);
  that check compared vertical bounds against the nearest scrolling ancestor
  only, so a marker carried sideways out of this new strip kept its panel open
  over a neighbouring column. The clip box is now the intersection of every
  scrolling ancestor, tested on both axes.
- The eight-column ceiling stays as it is. It is a limit on how much the user
  can usefully compare, not a layout guard, and the floor no longer needs it to
  be one.

## Rejected alternatives

- **Measure and collapse** — hide or fold columns once they get narrow. Rejected
  for the reason ADR-0011 rejected it for the tool bar: it needs a
  `ResizeObserver` scheme and per-column measurement, and it decides on the
  user's behalf which manuscript stops being visible in a side-by-side
  comparison, which is the one thing the workspace is for.
- **A viewport breakpoint that caps the visible column count.** Rejected: it
  makes columns vanish and reappear as the window is dragged, and the count that
  fits depends on the IIIF panel's width too, so the breakpoint would be wrong
  in one of the two states.
- **Let the columns shrink and rescue only the controls** (icon-only header, ←/→
  moved into a menu). Rejected: it keeps the controls reachable but leaves the
  text unreadable, and reading the text is the point of the column.
- **A horizontally scrolling strip with a fixed column width** (no `flex-1`).
  Rejected: it would scroll on a wide desktop too, where everything fits today.
