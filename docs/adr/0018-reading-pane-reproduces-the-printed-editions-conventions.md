# 18. The reading pane reproduces the printed edition's conventions

- Status: Accepted
- Date: 2026-08-05
- Deciders: Zhou Dejian
- Supersedes: [ADR-0016](0016-reading-pane-renders-plain-text.md)

## Context

[ADR-0016](0016-reading-pane-renders-plain-text.md) stripped every mapped element
of colour, weight, size, style and decoration. It was right about what it was
against: a pane that announced its annotation layer before it showed the text,
and a `@rend` class table that set a `decor` initial at three times body size in
bold red. It was right about the premise, too — the markup's job is to be present
in the DOM, and every `data-tei-*` attribute reaching the page is what the Tag
Filter (#147) and the entity navigation (#164) were later built on.

What it could not answer was the question it named in its own "considered
options": *whose typography?* Faced with bold `head` and italic `signed`, it
found no principle that decided them element by element, and so it decided them
all the same way — none. That is a defensible answer to an unanswerable question,
but the question turned out to be answerable.

These four manuscripts are witnesses to a text that has a printed diplomatic
edition, and that edition has conventions. They are not matters of taste. An
Irish diplomatic edition sets an expanded abbreviation in italic because that is
how a reader tells the editor's letters from the scribe's; it is the discipline's
convention, not a designer's. The reading pane was rendering less than the print
edition it sits beside.

## Decision

**The reading pane sets the manuscript the way the printed edition of this text
does.** A future reader asking whether an element may be styled asks *"does the
print edition set it this way?"* — not *"what looks good here?"*. That is a
decidable question, which is the whole of why this supersedes ADR-0016 rather
than reverting it.

**ADR-0016's premise stands.** The markup's job is still to be present in the
DOM. Every `data-tei-*` attribute still reaches the page, `data-tei-rend`
included, and nothing here is a return to the class table ADR-0016 deleted.

Four conventions, and no others. Counts are from the four authoritative
manuscripts in `backend/tei/AcS_*.xml`.

### 1. An expanded abbreviation is set in italic — 2767 `<expan>`

This corpus uses `<expan>` non-standardly: it wraps the letters the editor
supplied, inline inside a word (`rīa<expan>n</expan>`), rather than acting as the
standard TEI container around an `abbr` + `ex` pair. There is no `abbr`, `ex` or
`choice` anywhere in the four files. So the italic lands on exactly the letters
the manuscript does not write, which is what the convention is for.

Expansions are dense enough here that the effect is conspicuous. That is the
edition being faithful, not a defect.

### 2. `hi rend="decor"` is set bold — 154 `<hi>`, every one of them `decor`

`decor` is not only a decorated initial. 119 of the 154 wrap a single letter, but
the rest wrap whole words or clauses — `Cōicer` (×7), `ĪAR` (×2), `IS annsin`,
and two spans of 24 and 29 characters in FranA4 that bold a full line. One is
empty (`<hi rend="decor"></hi>`). Four contain an `expan`, so the two rules
compose: `ĪA<expan>R</expan>` renders bold with the `R` bold-italic.

**One declared mapping, not a class table.** The table ADR-0016 deleted
recognised five tokens and silently dropped every other one, so an unseen
`rend="italic"` came out mis-set. Here any `@rend` that is not `decor` is left
untouched and reaches the DOM whole.

The match is on the **token**, because `@rend` is the whitespace-separated token
list TEI says it is and the codebase already read it that way: `decor italic` is
a `decor`; `decoratedCapital` is a different token and is left alone.

### 3. A quatrain number hangs in the margin — 202 `<lg type="quatrain" n="N">`

`@n` reaches the DOM and the number sits outside the text block, left of the
verse's own left edge — right-aligned in the indent's gutter, so a run of
quatrains reads as a column of numbers with the verse starting level.

The indent stays: it is still the only thing carrying the annotator's
verse-versus-prose analysis, since these manuscripts are written continuously.
What changes is its unit. ADR-0016's `pl-4` is a `rem`, and the reading pane's
font size is a user control (10–24px, set inline in `DocumentArea`) that a `rem`
does not answer to — at 24px a two-digit number is wider than 16px and lands on
top of the verse. 139 of the 202 groups are two-digit, so that is the common case
and not an edge. The gutter is `2em` instead, which resolves against the pane's
own size and keeps the number and the verse in step at every setting.

**Having an `@n` is what makes a group numbered**, not `@type="quatrain"`. Every
`lg` in the corpus is a quatrain, so a `@type` gate would be a branch no document
exercises — the trap ADR-0016's own postscript warns about.

### 4. `pb` and `cb` are editorial locators, and there are two coordinate systems

| | System | Shape | Rendering |
| --- | --- | --- | --- |
| `pb edRef` + `cb` | the **manuscript locator** — folio / column | `fol.124ra`, `p.36b` | bold, in square brackets: `[fol.124ra]` |
| `pb xml:id` | the **print-edition locator** — a page of Stokes | `Stokes_p.69` | tinted box, no brackets |

The box rather than the brackets is what tells the two systems apart on the page.
A page of Stokes is a locator into a modern printed edition, not into the
manuscript, and the reader has to be able to see which one they are being given.
The tooltip says which system too — "printed edition, page Stokes_p.69" against
"manuscript page fol.124" — rather than naming the tag, which says neither.

**`xml:id` is what selects the print edition; everything else is the
manuscript's own page.** In this corpus the two are equivalent — all 37 `pb`
carry exactly one of `@xml:id` or `@edRef` — but they differ on a `pb` that
carries only `@n`, which the older documents in `backend/tei/` do. Those are
manuscript pages, and `@n` is the manuscript's own locator wherever it appears,
so the default falls that way. Keying on `@edRef` instead would leave a bare-`@n`
`pb` in a third, unstyled state that no rule here describes.

`xml:id` is shown **verbatim**, underscore and all. No prefix is added and no
substring is parsed out. ADR-0016 was written partly because a hard-coded prefix
produced `p. p.35`; parsing `p.69` out of `Stokes_p.69` is the same class of
risk, differing only in which direction it guesses.

The brackets are not a prefix. They are the editor's mark — the same class as
`supplied`'s `⟨⟩` and `gap`'s `[…]`, which ADR-0016 kept for exactly this reason
— and they wrap whatever the value says without reading it.

**Both are inline.** Every `pb` in the corpus sits mid-sentence (`í ó sin <pb/>
amach go`) and several sit inside an `<l>`. The block-level `pb` ADR-0016 left in
place cut both in half, and a `pb` and a `cb` cannot render identically while one
of them is a block.

**A `pb` whose next sibling element is a `cb` is not shown.** It stays in the DOM
under `hidden`, because the surviving premise is that the markup must be present
— `abbr` and `rdg` are hidden the same way. This suppresses 9 of the 18
`pb edRef`; the other 9 are in G126, which has no `cb` at all.

The rule loses nothing here: in all 9 cases the `cb`'s `@n` extends the `pb`'s
(`fol.124` → `fol.124ra`, `p.35` → `p.35b`), so the column locator already says
everything the page locator said. Showing both reads `[fol.124][fol.124ra]`.

**The condition is adjacency, not value containment.** Hiding on a value prefix
was considered and deliberately not chosen: it would read the locators, and
reading them is what ADR-0016 was written against. Whitespace between the two
tags is stepped over, since a pretty-printed file leaves it and it says nothing;
*text* between them is not, because those words are on the page the `pb` names
and before the column the `cb` names, so the column locator is no longer saying
everything the page locator said.

### `‖` is gone

ADR-0016 kept `‖` on `cb` because, with `col. ` dropped, a lone `@n` had nothing
marking it as editorial and a bare digit inside a verse line reads as manuscript
text. The brackets and the weight are that mark now. `‖[p.35b]` says the same
thing twice.

### The `note` exemption is carried over

`note`'s superscript marker keeps its colour and size. It is not a convention of
the printed edition and is not the manuscript's text at all — it is the
affordance saying a note is there to hover, and the panel it opens is floating
chrome. ADR-0016 exempted it for that reason and the reason is unchanged.

## Consequences

- **The guard test inverts, and keeps its mechanism.**
  `client/src/tei/presentation.test.tsx` still walks `elementMap` itself rather
  than a hand-kept list of elements, so an element added later is covered the day
  it is mapped. What changed is the verdict: a mapped element may carry a style
  this ADR names — in an `ALLOWED` table keyed by tag — and nothing else. Adding
  a style stays a decision rather than a reflex; it means arguing with `ALLOWED`
  and with this document. The table holds exact classes, not patterns, so
  allowing `font-bold` does not also wave `font-black` through, and a check
  fails the suite if a tag is named in `ALLOWED` but no longer in `elementMap`.
- **Sibling context reaches a component for the first time.** A `pb` cannot see
  what follows it — `TEIRenderer` hands each component its own subtree — so the
  renderer's existing pre-pass works it out and passes `followedByCb`, the same
  seam `noteNumber` (#154) arrives through. The pre-pass already had to walk
  every node; this costs one lookahead per child.
- **The structural hierarchy ADR-0016 dropped stays dropped.** `head` is still
  not bold, `signed` and `trailer` still not italic, `dateline` still not small
  and grey. None of them is one of the four conventions, and the principle is
  what decides — not the fact that they used to be styled. `head` is still an
  `<h3>` in the DOM for anything that later argues the print edition sets it.
- **Search highlighting is untouched.** Every mark this adds — the brackets, the
  boxed id, the quatrain number — lives in a child span, never in an anchor's own
  text children. Highlighting resolves a word's character offsets against exactly
  those children (`wordRange.ts`) and the backend counted only what the
  manuscript has, so a mark inlined there would shift every offset in the
  element. `supplied`'s `⟨⟩` are nested for the same reason. Italic and bold move
  no offsets at all: they change how a character is drawn, not how many there
  are, which is why the expansion convention is free.
- **`bg-stone-200` is the one background colour in the pane.** Neutral on
  purpose: orange, blue and violet are all spoken for by the highlight tiers in
  `index.css`, and a locator must not read as a search result.

## Note on the issue's evidence

Unlike #153 and #147, #165's TEI statistics check out. Every count above was
re-derived from `backend/tei/AcS_*.xml` before implementation and matched:
2767 `expan`, 154 `hi` all `rend="decor"`, 202 `lg` all `type="quatrain"` with an
`@n`, 18 `pb edRef` and 19 `pb xml:id`, 14 `cb`, and no `abbr`, `ex` or `choice`
anywhere. Recorded because the two preceding TEI issues were wrong about theirs,
and a reader who knows that should also know when a check came back clean.

The count that most needed checking was the G126 exception: G126 holds exactly 9
`pb edRef` and 0 `cb`, so it is the whole of the "renders" side of convention 4.

## Considered options

- **Revert ADR-0016.** Rejected. Its premise is what the last three features were
  built on, and reverting would bring back the class table and the `p. p.35`
  prefix along with the typography.
- **Style by taste, element by element.** Rejected: that is the question
  ADR-0016 declined to answer, and it has no stopping condition. "The print
  edition sets it this way" does.
- **Rebuild the `@rend` class table.** Rejected. The corpus exercises exactly one
  value. A table would re-introduce the failure ADR-0016 diagnosed — recognising
  some tokens and mis-setting or dropping the rest — in exchange for coverage
  nothing needs.
- **Hide a `pb` whose `@n` is a prefix of the following `cb`'s.** Rejected: it
  reads the locators to decide, and every bug ADR-0016 catalogued came from code
  that read them. Adjacency decides the same 9 cases without looking at a value.
- **Show both locators and let the reader sort them out.** Rejected: `[fol.124]
  [fol.124ra]` twice on every column break, saying nothing the second does not.
