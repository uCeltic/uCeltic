# 22. The guided tour advances as the workspace changes

- Status: Accepted
- Date: 2026-08-07
- Deciders: Zhou Dejian

## Context

The first-run spotlight tour ([#125](https://github.com/uCeltic/uCeltic/issues/125))
is a click-through: five cards, each describing a region of the workspace, each
advanced by pressing **Next**. The store held one number, `stepIndex`, and Next
incremented it.

That shape has a specific failure. The tour's own premise is that it is
non-blocking — the overlay is `pointer-events-none` so the reader can work the
page it is drawn over — but nothing in it ever looked at whether they did.
A reader who pressed Next five times without touching anything reached the end
of the tour having been taught nothing, and the tour could not tell the
difference. The cards, in turn, were written to describe *places* ("this menu",
"this button") rather than to ask for *actions*, because an action nobody
checks is only a suggestion.

The follow-up to this slice replaces the five cards with an eleven-step script
in which every card names one action. That script is unbuildable on a pointer
that only Next moves.

## Decision

**The step showing is derived from the workspace, not stored.**

Every step declares a **gate**: a predicate over a snapshot of workspace state,
reading "this step's action has happened". The **derived step** is the first
step whose gate is unsatisfied. The last step declares no gate — it names
nothing left to do, and derivation stops there.

The three rules that make this usable:

**1. `max(derived, manual)`.** The store keeps a manual pointer, moved only by
Next and Back, and the step shown is the larger of the two. So Next always moves
forward, including past a step whose action the reader does not want to perform
— a reader with no interest in changing the text size is never held there — and
no gate can pull the card back to a step Next has already left. The tour cannot
trap anyone. Back moves the manual pointer back, but only down to the derived
step: below that the next frame would derive the same card again, so Back is
disabled there rather than lying.

**2. The latch boundary is the search step.** Before any search has completed,
gates read live state, so the tour follows the workspace *backwards* as well as
forwards: close a column while the opening step is still in play and the card
returns to the step that asks for it. This is the right behaviour early, when
the reader is experimenting with the controls the tour is naming and undoing an
action means they have not done it after all.

Once a search has completed, every step up to and including it latches for good,
and each later step latches on its own as its action happens. Moving through
results and changing the text size are reversible; being taught them is not. A
reader who steps to the third match and back to the first has learnt what `←`
and `→` do, and a tour that rewound there would be arguing with them.

**3. Re-opening from Help clears the latches after the search, and touches
nothing else.** The workspace is left exactly as it is, so a reader who already
has two columns open and a search behind them resumes past the opening steps
rather than being sent back to open documents they have already opened. What the
clearing buys is the later steps: those are the ones worth teaching again to
somebody who came back to the tour on purpose.

**The gates in this slice** read stores that already exist, and record nothing
for the tour's benefit: two or more documents open; a search that ran to
completion; result navigation past the first match; a text size other than the
one the workspace starts at. A search that *errored* does not count — the column
offers its own Retry ([ADR-0012](0012-retry-replays-the-recorded-search-attempt.md)),
and nothing has been shown yet — while a search that found **nothing** does:
what the reader has just seen is what searching does.

**The card is placed beside the ring, not under it**: right of the ring first,
then below, then above, and clear of any dropdown the ringed control has open.
The card is exactly as wide as the Works dropdown (`w-80`), and a dropdown hangs
directly beneath the button that opens it — a card placed below the ring lands
squarely on the list the step is asking the reader to use. On a tour that only
described the workspace this was cosmetic; on a tour whose steps must be
*performed*, a card covering its own control makes its step impossible.

The five cards' wording is deliberately unchanged here. This slice builds the
mechanism and proves it against signals the stores already carry; the eleven-step
script is a follow-up, and shipping both at once would leave a failure in either
one indistinguishable from a failure in the other.

## Update (#178) — the script this was built for

The five cards this slice kept have been replaced by the eleven steps of the
select-to-search workflow. The mechanism above is unchanged; three things it did
not have to answer with five general cards, it does now.

**Gates may probe the DOM.** Three of the eleven steps wait on state no store
holds — the Works dropdown being open, how many versions are ticked, whether a
passage is selected. All three live in component state or in the browser's
selection, and none of them belongs in a store: they are disclosure and transient
input, not workspace state anybody else reads. The tour probes the rendered
markup instead (`tourDomSignals.ts`), in the animation frame it already runs for
the ring — a dropdown opening fires no event the tour could listen for anyway.
The coupling to how those panels render is real and deliberate: each `data-tour`
attribute is placed for exactly one gate, and the probes are tested against the
**real panels**, so a change in their shape fails a test rather than quietly
stalling the tour.

**A gate may also accept evidence that the step is behind the reader.** Clicking
"Open selected" closes the dropdown and clears the ticks: the one action that
satisfies step 4 un-satisfies steps 1–3, and before the latch boundary gates read
live state. So those three gates read "…or the versions are open". This is the
narrow exception, not a pattern — it applies exactly where the workspace erases
the evidence *as a direct consequence of the next step*, and each such gate says
so where it is written.

**The tour and the drag-reorder hint divide one lesson.** The hint appears the
moment a second column does — during step 4, five steps before the tour has
anything to say about dragging. While the tour is open the hint stays out of the
way, and once the tour's own reorder step is passed it is marked acknowledged
through the same `localStorage` key it has always used, so it does not surface
after the tour ends. A reader who skips the tour keeps the hint exactly as it
behaves today: skipping records nothing about it.

## Consequences

- **This corrects [#125](https://github.com/uCeltic/uCeltic/issues/125).** Its
  overlay, its anchors, its non-blocking guarantee and its
  dismissed-for-good storage all stand; what it retires is the click-through
  pointer, `stepIndex`, which no longer exists.
- Derivation is a pure function over four values (`tourProgress.ts`), so which
  step a given workspace is at is asserted directly in unit tests, with no
  overlay mounted and no store involved. `tourSignals.ts` is the one place that
  knows both a store and the tour exist.
- The tour now re-renders on document, search and workspace store changes. The
  signals are selected down to primitives and memoized, so a store change that
  moves none of them re-renders nothing.
- `DEFAULT_FONT_SIZE` is exported from `workspaceStore.ts`: "the reader changed
  the text size" needs something to compare against, and the initial value was
  previously a literal in the store body.
- `data-tour-panel` marks the Works and overflow-menu dropdowns, so the card can
  keep clear of an open panel as well as of the ring. It is one attribute with
  no behaviour of its own; a panel that forgets it will be covered, which is
  visible the moment that step is walked.
- **A reader who performs a step's action early is never shown that step.**
  Change the text size before searching and the text-size card is derived past
  the moment it is reached. This follows from derivation itself — a gate cannot
  tell "already knows how" from "happened to have done it" — and it is the
  behaviour worth having: the tour asks for what has not been done. It also
  bounds what re-opening from Help gives back, since a step whose action still
  holds is skipped whether or not its latch was cleared.
- A step with no gate stops derivation. That is what makes the final card final,
  and it means the eleven-step script must give every non-final step a gate — a
  card without one silently becomes a wall.

## Rejected alternatives

- **Advance on the raw event ("the reader clicked Search")** rather than on
  state. Rejected: the tour would then need its own listeners on controls it
  does not own, and would advance on a search that errored, teaching a step the
  reader never saw the result of. State says what happened; an event only says
  what was attempted.
- **Let gates alone decide, with no manual pointer.** Rejected: a reader who
  does not want to perform a step would be stuck on it with a Next button that
  did nothing. The tour is non-blocking by design, and that has to include the
  card.
- **Latch every step from the start.** Rejected: it costs the early rewind,
  which is exactly where it is worth having — the opening steps are performed
  while the reader is still discovering the controls, and an undo there means
  the step really has not been done.
- **Latch nothing, ever.** Rejected: closing a column after a search would send
  the reader back to "Open two documents", re-teaching what they have plainly
  learnt. Undoing an action must not un-teach it.
- **Record tour-specific progress flags** on each action (a `hasSearched`
  boolean set by `runSearch`). Rejected: it scatters the tour across the stores
  and creates a second, redundant account of what the workspace already knows,
  which can then disagree with it.
