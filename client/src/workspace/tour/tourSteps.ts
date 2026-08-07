// Type-only, so the two modules can name each other without a runtime cycle:
// the gates are declared here and evaluated there.
import type { TourSignals } from "./tourProgress";

/**
 * The guided tour's script: the eleven steps of the workflow this tool exists
 * for (#178) — open two versions of one work, search a passage of one against
 * the other, and move through what comes back.
 *
 * It replaces the five cards of #125, which named regions of the workspace
 * ("this menu", "this button") and were advanced only by Next. Each card here
 * names **one action**, and the tour moves on when that action happens
 * (#177, ADR-0022). A card's gate is therefore part of its copy, not an
 * implementation detail: what the card asks for and what the gate waits for
 * must be the same thing.
 *
 * **Names in the copy are examples, never targets.** A card may say "Acallam na
 * Senórach" and print two lines of verse, but every gate matches on the shape of
 * the action: *any* work expanded, *any* two versions ticked, *any* text
 * selected. The corpus decides which works are listed and which documents come
 * first — the catalogue is newest-first by upload — so a gate requiring a named
 * work or "the first two documents" would break the first time the corpus is
 * re-imported. That is the drift WorkPicker's "no work name is written down in
 * this file" exists to prevent (#152).
 *
 * Each step points at one or more live anchors by their `data-tour` attribute.
 * The elements carrying these attributes live in ToolBar, WorkPicker,
 * DocumentArea, SelectionSearchButton and HamburgerMenu — keep the ids here in
 * step with the markup there. A step may name several selectors: the spotlight
 * rings the box that encloses all of them. A selector that matches nothing right
 * now — the floating select-to-search button before any text is selected, the
 * result card before any search — is simply not ringed; the card still shows,
 * because the tour is non-blocking and the reader is expected to perform the very
 * action that brings that anchor on screen.
 *
 * Three gates read state no store holds — the Works dropdown being open, how
 * many versions are ticked, and whether a passage is selected. They probe the
 * markup (`tourDomSignals.ts`), and the step list below says which anchor each
 * one depends on, because that coupling is real and only tests will catch a
 * break.
 *
 * ADR-0008: the search step deliberately points at the floating select-to-search
 * button, never the toolbar's typed-query Search button.
 */
export interface TourStep {
  /** Stable key, handy for tests and keys. */
  id: string;
  /** `data-tour` targets, matched as `[data-tour="<value>"]`. */
  anchors: string[];
  title: string;
  body: string;
  /**
   * "This step's action has happened" (#177). The tour shows the first step
   * whose gate is unsatisfied, so a step's gate is what moves the tour off it —
   * the reader never has to press Next. A step with no gate names no action to
   * wait for; derivation stops there.
   */
  gate?: (signals: TourSignals) => boolean;
  /**
   * The one step that ends the rewindable stretch: until it is satisfied the
   * tour follows the workspace backwards too, and once it is, every step up to
   * and including it is taught for good. See tourProgress.ts.
   */
  latchBoundary?: true;
}

/**
 * The step that teaches drag-reordering, which the one-time drag-reorder hint
 * would otherwise teach five steps earlier — the hint appears the moment a
 * second column does. DocumentArea suppresses it while the tour is open, and
 * the overlay marks it acknowledged once this step is passed (#178).
 */
export const DRAG_REORDER_STEP_ID = "reorder-columns";

/**
 * Whether the reader has got past the opening steps by any route.
 *
 * Clicking "Open selected" closes the dropdown and clears the ticks: the very
 * action that satisfies step 4 un-satisfies steps 1–3. Before the latch
 * boundary gates read live state (that is what lets the tour follow the reader
 * backwards), so without this the tour would snap back to "Click Works" the
 * instant the columns opened.
 */
const versionsAreOpen = (s: TourSignals) => s.openDocumentCount >= 2;

export const TOUR_STEPS: TourStep[] = [
  {
    id: "open-works",
    anchors: ["open-works"],
    title: "Start with Works",
    body: "Everything starts here. “Works” lists the stories the corpus holds. Click it.",
    // Gate: the dropdown panel is on screen — `data-tour="works-panel"`.
    gate: (s) => s.worksDropdownOpen || versionsAreOpen(s),
  },
  {
    id: "expand-work",
    anchors: ["work-branch"],
    title: "Open a story",
    body: "Click a story — Acallam na Senórach, say — to see its versions. A version is one manuscript witness of that story, digitized; this is a tool for reading them against each other.",
    // Gate: some work is showing its versions — `data-tour="version-list"`.
    // Any row will do: the corpus decides what is listed, and in what order.
    gate: (s) => s.workExpanded || versionsAreOpen(s),
  },
  {
    id: "tick-versions",
    anchors: ["version-list"],
    title: "Tick two versions",
    body: "Tick two of them. Two, because the next steps search one against the other — a single column has nothing to be compared with.",
    // Gate: two ticked checkboxes inside `data-tour="version-list"`. Which two
    // is the reader's business.
    gate: (s) => s.versionsTicked >= 2 || versionsAreOpen(s),
  },
  {
    id: "open-selected",
    anchors: ["open-selected"],
    title: "Open them side by side",
    body: "“Open selected” gives each ticked version its own column. Both stay open, and both are searched.",
    gate: versionsAreOpen,
  },
  {
    id: "select-passage",
    anchors: ["column-text"],
    // Position, not text: "the first two lines of the opening quatrain" is
    // findable in every witness, while the wording below is one witness's.
    title: "Select a passage",
    body: "In one column, select the first two lines of the opening quatrain. In one witness they read:\n\n“Gleand Rois Enaig bīdh dham / bidh binn guth cluic ann nach tan”\n\nYour column may spell them differently — the witnesses do — and that is the point: the search matches across spellings, so select whatever your column actually says.",
    // Gate: a selection with both ends inside a `data-tour="column-text"` pane.
    // A fired search counts too: clicking Search can collapse the selection,
    // and having selected a passage is not undone by having searched it.
    gate: (s) => s.passageSelected || s.searchFired,
  },
  {
    id: "selection-search",
    anchors: ["selection-search"],
    title: "Search the other columns",
    body: "A “Search” button appears under your selection. Click it: it looks for that passage in the *other* open documents, never in the one you selected from.",
    gate: (s) => s.searchFired,
  },
  {
    id: "read-result",
    anchors: ["result-card"],
    title: "Read what came back",
    body: "Each searched column reports its own best match at the top: which match you are on, its line, and a score. “No search results” is an answer too — that witness may simply not carry the passage.",
    gate: (s) => s.searchCompleted,
    // Everything up to here is taught for good once a search has come back:
    // closing a column afterwards must not send the reader back to open it
    // again (ADR-0022).
    latchBoundary: true,
  },
  {
    id: "navigate-results",
    anchors: ["result-nav"],
    title: "Move between the matches",
    body: "← and → step through that column's matches, and the text scrolls to each one. Each column steps through its own — they are different manuscripts, and their matches are not the same passages.",
    gate: (s) => s.resultNavigated,
  },
  {
    id: DRAG_REORDER_STEP_ID,
    anchors: ["column-grip"],
    title: "Put the columns in your own order",
    body: "Drag a column by its title to move it. Compare whichever two you like side by side — the search always runs over every open column, whatever order they are in.",
    gate: (s) => s.columnsReordered,
  },
  {
    id: "font-size",
    anchors: ["menu"],
    title: "Change the text size",
    body: "Open this menu to make the text larger or smaller with the A− and A+ controls.",
    gate: (s) => s.fontSizeChanged,
  },
  {
    id: "manuscripts",
    anchors: ["manuscripts"],
    title: "Show or hide manuscripts",
    body: "Toggle the manuscript images panel on or off with this button. That's the tour — happy searching!",
    // No gate: the last card has nothing left to wait for, and "Done" ends it.
  },
];
