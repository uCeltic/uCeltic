# 16. The reading pane renders the document as plain text; the markup lives in the DOM

- Status: Accepted
- Date: 2026-07-28
- Deciders: Zhou Dejian

## Context

Every TEI element the renderer maps used to style the text it wrapped. Named
entities carried a dotted underline and a colour each (emerald for `persName`,
teal for `placeName`, orange for `orgName`); `@rend` selected from a class table
that set a `decor` initial at three times body size in bold red; verse groups
drew a grey left rule; a page break drew a full-width horizontal rule; `gap`,
`lacuna`, `ex`, `sic`, `damage`, `unclear` and `surplus` each had a colour,
a wavy underline or an opacity of their own.

None of it was asked for by an editor, and together it made a reading pane that
could not be read: the page announced its own annotation layer before it showed
the text. It also pre-empted a decision that belongs downstream — the Tag Filter
(#147) needs to paint one chosen entity, and it had to reach two attributes deep
to outrank the colour each name was already wearing.

The same components carried a second defect. `pb` hard-coded a `p.` prefix onto
`@n` and `cb` fell back to `col. {n}`, but `@n` is a page number in one
manuscript, a folio-column-line locator (`124ra1`) in the next, and in some
transcriptions already carries its own prefix — so the pane could read `p. p.35`.

## Decision

**The reading pane shows the document, not a rendering of its annotation.** No
mapped element applies colour, font weight, font size, font style, text
decoration, letter case, opacity or a rule to the manuscript's text (#153).

**The markup's job is to be present in the DOM**, not to decorate the page.
Every `data-tei-*` attribute reaches the page exactly as before, `data-tei-rend`
included — so opting entity highlighting back in is a CSS rule against
`[data-tei-entity]`, not a change to these components.

Four things are kept, because they are not decoration:

- **Layout and spacing.** Paragraph and verse-line arrangement, and `lg`'s
  indent — these manuscripts are written continuously, so verse-versus-prose is
  the annotator's analysis and the indent is the only thing carrying it. The
  grey rule beside it said nothing the indent had not.
- **The editorial characters the renderer inserts** — `⟨⟩`, `[…]`, `[* *]`, `‖`.
  A print edition carries these too. Their colour goes; the characters stay.
- **`display: none` on `abbr` and `rdg`.** That is structure, not styling:
  without it an abbreviation and its expansion both render.
- **Semantic elements the browser already styles.** `del` and `surplus` stay
  `<del>`, so the user agent's own strike-through survives with no class of ours.

One exemption: **`note`'s superscript marker is styled as the control it is —
colour and size both.** It is not the manuscript's text — it is the affordance
saying a note is there to hover — and the panel it opens is floating chrome. It
carries the note's number rather than an asterisk (#154), which is why the size
is in the exemption: a two-digit number at `text-xs` is hard to read and hard to
hit. The marker still answers to the reading pane in one way — it takes its own
`leading-none`, so growing it does not open up the verse lines it sits in.

`pb` and `cb` emit `@n` verbatim and prefix nothing; `cb` still prefers `xml:id`
when it has one, because that names the folio *and* the column.

## Consequences

- **The policy is enforced by the suite, not by memory.**
  `client/src/tei/presentation.test.tsx` walks `elementMap` itself and fails on
  any mapped element carrying a presentational class, so an element added later
  is covered the day it is mapped. Adding a style means arguing with a test.
- **`elements/rend.ts` is deleted.** `@rend` is no longer interpreted at all; it
  reaches the DOM whole as `data-tei-rend`, which is more than the class table
  passed on — that table recognised five tokens and dropped every other one.
- **The Tag Filter's third tier is now the only rule that paints a named
  entity.** `[data-entity-focus] [data-tei-entity]` in `index.css` greys the
  entities not being followed; nothing colours them otherwise. Its
  `text-decoration-color` went with the dotted underline it used to tint.
- **A `cb` with only a bare `@n` now reads `‖ 1`** in the built-in corpus, where
  it used to read `‖ col. 1`. The prefix was there because a lone digit inside a
  verse line can be read as manuscript text; `‖` is what distinguishes it now.
  Accepted knowingly: no fixed prefix can be right for both a bare `1` and an
  `@n` that already says `p.35b`.
- **Structural elements lost their typographic hierarchy too** — `head` is no
  longer bold, `signed` and `trailer` no longer italic, `dateline` no longer
  small and grey. They keep their spacing. This was the deliberate reading of
  "every mapped element", not an oversight; a heading is marked as one in the
  DOM (`<h3>`, `data-tei-anchor-id`) for anything that later wants to set it.
- **`rubric` gained `data-tei-tag="rubric"`.** With the styling gone it had no
  mark in the DOM at all, which contradicts the premise above.

## Note on the issue's evidence

#153 justified the `pb`/`cb` change with `<pb n="p.35"/>` and `<cb n="p.35b"/>`,
and the `@rend` change with 150 uses of `rend="decor"`. Neither value occurs in
`backend/tei/` — its `pb` are `124ra1`, `127.20`, `41[a`, its `cb` are a bare
`1` or `2`, and the nearest rendition is a single `rend="decoratedCapital"` in
`shakespear.xml`. The decision stands on its own terms (`p. 124ra1` is wrong
about a folio locator whatever else is true), and the criteria naming those
values are exercised synthetically. Recorded here so a later reader does not
take the counts as corpus facts. See also #147, where an issue's TEI statistics
were exactly inverted.

## Considered options

- **Keep the styling and let the Tag Filter outrank it.** Rejected: that is the
  status quo, and it already forced a two-attribute-deep selector to win against
  a colour nobody asked for. Each new feature that wants to mark text would pay
  the same tax.
- **Strip the colour but keep the typographic hierarchy** (bold `head`, italic
  `signed`/`trailer`). Rejected: it leaves the same question — whose typography?
  — to be answered element by element, and the guard test would need a
  hand-kept allowlist that drifts. The DOM still carries `<h3>`, so restoring a
  hierarchy is a stylesheet away.
- **Delete the `data-*` attributes along with the styling.** Rejected outright:
  they are the point. The Tag Filter reads them today, and opt-in entity
  highlighting is the next thing that will.
