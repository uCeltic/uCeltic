# 21. The Tag Filter marks what is followed, and nothing else

- Status: Accepted
- Date: 2026-08-07
- Deciders: Zhou Dejian

## Context

The Tag Filter (#147) followed one person or place through every open column,
and painted three visual tiers, described in CONTEXT.md as "matching the ctrl+F
convention":

| Tier | On screen | Where |
| --- | --- | --- |
| 1 | the current occurrence, solid violet `#A78BFA` | `::highlight(tag-entity-active)` |
| 2 | that entity's other occurrences, tinted `#EDE9FE` | `::highlight(tag-entity-other)` |
| 3 | **every other named entity, greyed to `#9CA3AF`** | `[data-entity-focus] [data-tei-entity]` |

Select `Oisīn` and the third tier repaints `Chaílti`, `Find`, and every other
name the manuscript marks up. A page of Middle Irish that the reader is there to
read looks damaged.

Two things are wrong with the tier, and neither is a bug in how it was built.

**Its stated rationale contradicts the code it sits in.** The comment in
`DocumentArea.tsx` said the dimming made the followed entity stand out from "a
page that is otherwise full of coloured names". But the CSS rule doing the
dimming was, by its own comment, "the only rule that paints a named entity at
all": name elements carry `data-tei-*` markup and no styling (#153), and still
do under [ADR-0018](0018-reading-pane-reproduces-the-printed-editions-conventions.md),
where a name is not one of the printed edition's conventions and none of those
conventions is a colour. There were no other coloured names. The tier solved a
problem it invented.

**The ctrl+F analogy does not reach it.** Browser find is current-match plus
other-matches. It has never dimmed non-matches. The analogy justifies tiers one
and two and stops there.

## Decision

**Delete the third tier outright** — the `data-entity-focus` attribute, the CSS
rule, and the test that pinned it. What the Tag Filter marks is what the reader
asked to follow; every other name stays plain text, exactly as it reads with no
entity selected at all.

The attribute goes rather than staying inert: a DOM attribute with no effect is
a puzzle that needs a comment to explain itself. `data-tei-entity` is already
the seam any future opt-in highlighting of names would hang off, and it stays.

**Raise the second tier from `#EDE9FE` to `#C4B5FD`.** This is a consequence of
the deletion, not a separate wish. Against the column's parchment ground
`#f5f6ee`:

| Tint | Contrast vs `#f5f6ee` |
| --- | --- |
| `#EDE9FE` (old tier 2) | **1.09:1** |
| `#C4B5FD` (new tier 2) | **1.70:1** |
| `#A78BFA` (tier 1) | **2.50:1** |

`#EDE9FE` was legible only because everything around it greyed out. Remove the
dimming and the second tier goes with it, collapsing the feature to a single
visible occurrence — which is not the ctrl+F convention either. `#C4B5FD` is
visible on its own and still plainly under tier 1, so the two stay ranked.

Everything else is unchanged: `#FB923C` (search), `#93C5FD` (query source),
`#A78BFA` (current occurrence), and the priority table in `tei/highlight.ts`
(#164) that decides which of them covers which where two land on the same words.

## Consequences

- CONTEXT.md's "three visual tiers" becomes two, and "these tiers are the only
  thing that marks a named entity on the page" gains the clause that matters:
  they mark **one entity at a time**.
- Nothing in the render path changes. The deleted tier was one attribute and one
  CSS rule; `rebuildEntityHighlights` never knew about it, and the entity
  navigation card, the counts, and the ←/→ stepping are untouched.
- The parchment scheme is unchanged. The warm ground (`#f5f6ee`, `#E8E3CE`,
  `#F0EEE6` — hue 60–70°, very low chroma) and its cool complementary highlights
  were already coherent; only the tier that could not be seen moved.
- **A page with the Tag Filter on now looks close to a page with it off** when
  the followed entity is absent from that column, which is correct: a column
  that never names the entity has nothing to say, and its navigation card
  already says so (#164).

## Rejected alternatives

- **Keep the tier, lighten the grey.** Rejected: it makes the damage subtler
  without making it justified. The tier's premise — competing coloured names —
  is false at any strength.
- **Keep `data-entity-focus` as an inert hook** for a future preference. Rejected
  under YAGNI: `data-tei-entity` is the seam already, and it is on the elements
  themselves rather than on a container whose one job was the deleted rule.
- **Make the dimming a user preference.** Rejected: a setting whose default is
  "off" and whose rationale is false is a setting nobody turns on, and it costs
  a control in a menu that #174 has just finished trimming.
