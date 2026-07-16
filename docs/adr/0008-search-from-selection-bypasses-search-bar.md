# 8. Search-from-selection triggers directly, bypassing the search bar

- Status: Accepted
- Date: 2026-07-17
- Deciders: Zhou Dejian

## Context

New feature: selecting text inside a TEI document viewer should let the user search
other open documents using the selected text as the query, optionally excluding the
document the selection came from. The open design question was how the search bar
(`ToolBar.tsx`'s single `query` input, backed by `useSearchStore`) relates to a
selection-originated query, and specifically how to tell a selection-triggered
search apart from a hand-typed one — the two need different behavior (only the
former knows which document to exclude).

The obvious-looking approach — auto-fill the search bar's text with the selection,
then let the user press the existing Search button — was rejected. `query` and the
input's `onChange` are shared, untagged state used for every hand-typed keystroke;
distinguishing "this text arrived via selection" from "the user is now editing it"
would require an extra provenance flag invalidated on every future edit, with no
clean point to drop that flag.

## Decision

Selecting text in a TEI viewer surfaces a floating button next to the selection.
Clicking it **runs the search immediately** — it does not write into or read from
the main search bar's `query` state. The fired search reuses whatever advanced
search parameters (`matchLength`, `precision`, `dissimilarityScore`, `topK`) are
currently set, and excludes the source document from the set of documents searched.

Selection-originated and typed searches are therefore two structurally separate
code paths that never share mutable state — there is nothing to disambiguate at
runtime, because a selection-triggered search never touches `query`/`setQuery` at
all.

Once the button is clicked, the browser's native selection (which collapses on
click) is replaced by a second CSS Custom Highlight (`query-source`, registered
alongside the existing `search-match-active` highlight from `client/src/tei/highlight.ts`)
painted over the same `Range`, so the user can still see which text drove the
search.

## Consequences

- The search bar's visible text and the query actually used for a
  selection-triggered search can differ at the same time — the bar keeps whatever
  the user last typed (if anything); the fired search used the selected text
  instead. The selected text's provenance is shown in the source document itself
  (the `query-source` highlight), not in the search bar.
- `search_performed` logging gains two fields — `query_origin: "selection" | "typed"`
  and `excluded_doc_id` — rather than a new Behavior Event type, since this is
  still "a search ran," just with extra provenance.
- Feature is scoped to TEI viewers only for v1; `.txt`/`.docx` columns are not
  wired in (consistent with search already being TEI-only end to end).

## Rejected alternatives

- **Auto-fill the search bar on selection, user clicks the existing Search
  button.** Rejected: shares mutable state with hand-typed queries, requiring a
  provenance flag with no clean invalidation point (every keystroke after
  autofill would need to decide whether the association still holds).
- **Per-document-column pending selection** (each open viewer tracks its own
  candidate query independently). Rejected in favor of a single global pending
  selection: simpler state (one `{sourceDocId, range}` instead of a
  `Record<DocumentId, ...>` map), and matches the search bar's own existing
  single-`query` model.
