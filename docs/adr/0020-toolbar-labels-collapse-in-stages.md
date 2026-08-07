# 20. Toolbar labels collapse in stages, ordered by information value

- Status: Accepted
- Date: 2026-08-07
- Deciders: Zhou Dejian

## Context

[ADR-0011](0011-desktop-only-responsive-scope.md) decided a two-breakpoint
toolbar: wide → text labels, below the breakpoint → icon-only with tooltips. It
was implemented as a single class, `toolbarLabel = "hidden xl:inline"`, worn by
every label on the bar.

One class means one flip. The full-label toolbar measures roughly 1250px, so
`xl` (1280px) was chosen as "the width where everything just fits" — and below
it, all seven labels go together. On a 1080p screen almost any window that is
not maximised sits below 1280, which makes icon-only not the degraded state but
the *normal* one. The bar a reader actually looks at all day is a row of
unlabelled glyphs.

The two-breakpoint scheme is right; the granularity is not. The labels are not
worth the same. Some repeat their icon; two of them are the only place on screen
that says what the workspace is currently filtered to.

## Decision

Labels collapse in **two stages**, ordered by how much the label says that its
icon and the button's own state do not:

| Tier | Width | Icon-only |
| --- | --- | --- |
| 1 | ≥ 1280 (`xl`) | nothing — every label shown |
| 2 | < 1280 | `Show`/`Hide Manuscripts`, `Add Text`, `Advanced` |
| 3 | < 1024 (`lg`) | also `Tags`, `Works`, `Search` |

`toolbarLabel` keeps its meaning and its value and becomes tier 2; a second
constant, `toolbarLabelPersistent = "hidden lg:inline"`, is tier 3.

The order follows from what each label carries:

- The manuscript control is a **toggle**. Its state is already in its colour and
  its `aria-pressed`, and its label is the longest string on the bar — the most
  redundant text buying the most space, so it goes first.
- `Add Text` and `Advanced` name an action their glyph (a file-plus, a pair of
  sliders) already names.
- `Tags` and `Works` render the **selected** entity and work. The tag icon says
  "a filter"; only the label says *Find*. Losing them costs the reader the one
  statement of what they are looking at, so they survive longest.
- `Search` is the bar's primary action and sits at the tier-3 boundary with
  them.

Tier 3 lands on `lg`, the width at which the Manuscript panel already
auto-hides — the point where the window has stopped being a workspace and is
being squeezed.

**Stock Tailwind breakpoints only.** `responsive.ts` already requires `lg`/`xl`
to be kept in step with the layout. A bespoke `min-[1150px]:` would be a third
number to keep in step, in a scheme whose whole failure mode is numbers
drifting apart.

### Carried along: the Search button's busy state

`{anySearching ? "..." : "Search"}` put the only sign of a running search inside
the label, which is hidden exactly when the bar is tight. Below the breakpoint a
search in flight had no visual feedback at all — already true today, and not
something a staged collapse could leave alone, since tier 3 would make it true
at more widths. The `SearchIcon` now swaps for a spinning `SpinnerIcon` while
`anySearching`, and the button carries `aria-busy`; both tiers behave the same.
The label stays the word "Search" throughout, so the button no longer changes
width mid-search.

## Consequences

- Two label constants instead of one. A new toolbar control has to pick a tier —
  which is the point: the choice is now explicit, and its reasoning is in the
  doc comment beside each constant.
- Between 1024 and 1280 the bar is mixed: four glyphs and three labelled
  controls. That is deliberate, not an unfinished state.
- Below 1024 the bar is icon-only, as before — the tooltips and `aria-label`s
  that made that acceptable under ADR-0011 are unchanged, and nothing in the
  client-requirement wording moves (the manuscript control's accessible name is
  still "Manuscripts", never "Books").
- `motion-reduce:animate-none` on the spinner leaves a reader who asked for less
  motion with `aria-busy` and the disabled button as the busy signal.

## Rejected alternatives

- **A third, bespoke breakpoint** (e.g. `min-[1150px]:`) to space the tiers more
  evenly. Rejected: see above — a number nothing else in the layout knows about.
- **Measuring the bar with a `ResizeObserver`** and dropping labels until it
  fits. Already rejected by ADR-0011 as too costly, and still is; it would also
  make the collapse order a runtime accident rather than a stated judgement.
- **Keeping one class and simply moving it to `lg`.** Labels would survive
  longer, but the bar would overflow between 1024 and 1280, which is the
  original problem in the other direction.
