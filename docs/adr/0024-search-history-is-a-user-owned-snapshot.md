# 24. Search History is a user-owned result snapshot, separate from Behavior Events

- Status: Accepted
- Date: 2026-08-28
- Deciders: Zhou Dejian

## Context

A new requirement asks that a signed-in user be able to look back at the searches
they have run, from their profile page, and export any one of them.

The workspace already records every search — but for the wrong audience and in
the wrong shape to answer this. A `search_performed` **Behavior Event**
(ADR-0003) records only *that* a search happened, is **researcher-only and
pseudonymized** (ADR-0004), and is deliberately never shown back to the person
who searched. A **Search Attempt** records one *column's* search but lives
client-side only, so a failed column's **Retry** can replay it (ADR-0012); it
never persists. Neither is a user-facing history, and neither keeps the results a
search returned — search results are computed server-side on every request and
never stored.

So the requirement forces two questions with real alternatives: (1) reuse the
existing Behavior Event stream, or stand up a new store; (2) store a re-runnable
query, or a snapshot of the results as they came back.

## Decision

**Search History is its own user-owned store, not a view over Behavior Events.**
Each entry belongs to a **User**, is readable and deletable *by that user*, and
is captured only when the user is signed in. This is a different audience,
lifetime, and access model from the pseudonymized, researcher-only event stream,
and the two must not be conflated even though they record the same underlying
action.

**An entry is an immutable result snapshot, not a saved query.** At the moment a
search settles, the query, timestamp, the four parameters, each open **Version**'s
title, and each column's hits (matched snippet + score) are frozen as **plain
text with no foreign key to any TEI Document**. Re-reading or exporting an entry
later reproduces *that* search verbatim, unaffected by a re-cut corpus, a renamed
or deleted Document, or a change to the matcher.

**Boundaries** (recorded fully in `CONTEXT.md` → Search History):

- one entry = one user-initiated search (typed or selection, ADR-0008); a
  **Retry** never creates or edits an entry;
- a column that *errored* is excluded from the snapshot — its failure is an
  **Error Report** (ADR-0013), not a second home in a user-facing log; a
  zero-hit column is kept; an all-errored search is not stored;
- auto-captured, capped at the **50 most recent** per user (the 51st drops the
  oldest); a user can delete one entry or clear all, each behind a confirm;
- export is per-entry, as a **Word `.docx`**, with the stored dissimilarity
  score rendered as a similarity percentage `(1 − score) × 100 %`.

## Consequences

- A new backend store and endpoints are added, owned by the User, separate from
  the study models. Its rows are *not* study data and must stay out of the
  pseudonymized analysis cohort.
- The snapshot denormalizes Version titles and result snippets, so it costs more
  storage than the events already logged — bounded by the 50-entry cap.
- Because the log rolls at 50, **export is the only durable copy** of a search;
  this is intended, not a gap.
- Anonymous searches keep no history, and pre-sign-in searches are not
  back-filled — the "same person before and after sign-in?" question ADR-0004
  leaves unanswerable by design stays that way.
- `CONTEXT.md` gains a **Search History** entry and the `_Avoid_` line "Saved
  Search / bookmark", so the next reader does not model it as a re-runnable
  query.

## Rejected alternatives

- **Re-surface the `search_performed` Behavior Events as the user's history.**
  Rejected: the events are pseudonymized and researcher-only by an explicit
  ethics stance (ADR-0004), and carry no results to show or export. Exposing them
  to the user would either break that stance or require joining back to identity
  the study deliberately keeps at arm's length.
- **Store a re-runnable saved query and recompute results on view/export.**
  Rejected: the requirement is "*what I searched and what came back*". Recomputed
  results drift from what the user saw as the corpus and matcher change, so the
  history would quietly stop being a record of the past. A snapshot cannot drift.
- **Keep a foreign key to the TEI Document for jump-back.** Rejected: it couples
  an immutable record to mutable, deletable rows — a deleted or re-imported
  Document would break old entries. Freezing the Version title as text keeps every
  entry whole forever, and jump-back was not asked for.
- **Unbounded history.** Rejected: auto-capture with no cap grows without limit
  and stores result snippets per hit. A rolling 50 keeps the useful recent tail
  and makes export the deliberate act for anything worth keeping longer.
