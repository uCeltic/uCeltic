# 12. A failed column's Retry replays the recorded Search Attempt

- Status: Accepted
- Date: 2026-07-23
- Deciders: Zhou Dejian

## Context

A failed column used to render the static text `Search failed — retry`, naming
an action nobody could take (issue #121). Turning it into a button raises the
question the issue could not settle on its own: **which search does it re-run?**

The failed search is not reconstructible from the app's current state:

- A selection-originated search carries its own query and never reads the search
  bar ([ADR-0008](0008-search-from-selection-bypasses-search-bar.md)), so a
  retry driven by `query` would silently search for something else entirely.
- The search bar's `query` and the four shared parameters (Match Length,
  precision, dissimilarity, top-k) are free to change between the failure and
  the click — a search bar edit or a slider nudge is exactly what a user does
  while looking at an error.

## Decision

Record each column's **Search Attempt** (see CONTEXT.md) in full at the moment
its search is fired — query, Query Origin, excluded source document, and all
four parameters — and have Retry replay that record whole.

So **Retry means "that search again"**, never "some search now". A user who
changes a parameter and then wants it applied runs a search; the button that
says Retry does not quietly become one.

Two boundaries are deliberate:

- The retry does **not** restore the query source highlight (issue #95) that a
  selection search leaves on its source text. That mark tracks whatever search
  the workspace last ran; one column retrying is no reason to move it.
- The attempt is dropped with the rest of a column's search state whenever that
  state is thrown away — a skipped source document, a closed column. A column
  with no attempt has nothing to replay and shows no button.

## Consequences

- `runSearch` gains an optional `params` override. Every other caller (toolbar,
  select-to-search) omits it and reads the live store values as before.
- A retry is a search like any other: it emits `search_performed`
  ([ADR-0003](0003-behavior-logging-for-requirements.md)) carrying the replayed
  query, origin and parameters. A retried failure therefore appears in the
  behavior log as two events with identical parameters — which is what makes
  "the user hit a failure and tried again" legible in the study data.
- A retry counts as a search in flight for the whole workspace: the toolbar's
  Search button disables and select-to-search hides for its duration
  (`selectAnySearching`, issue #96). Accepted — one column searching has always
  meant the workspace is busy, and a retry is not a special case of that.
