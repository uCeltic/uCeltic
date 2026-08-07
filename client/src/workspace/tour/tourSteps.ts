// Type-only, so the two modules can name each other without a runtime cycle:
// the gates are declared here and evaluated there.
import type { TourSignals } from "./tourProgress";

/**
 * The first-run spotlight tour (#125): a single select-to-search walkthrough.
 *
 * Each step points at one or more live anchors by their `data-tour` attribute.
 * The elements carrying these attributes live in ToolBar, WorkPicker,
 * SelectionSearchButton, HamburgerMenu, and DocumentArea — keep the ids here in
 * step with the markup there.
 *
 * A step may name several selectors: the spotlight rings the box that encloses
 * all of them (step 1 rings `Works` and `+ Add Text` together). A selector
 * that matches nothing right now — the floating select-to-search button before
 * any text is selected, the result nav before any search has run — is simply not
 * ringed; the card still shows, because the tour is non-blocking and the user is
 * expected to perform the very action that brings that anchor on screen.
 *
 * ADR-0008: the search step deliberately points at the floating select-to-search
 * button, never the toolbar's typed-query Search button.
 *
 * Each step also declares the action that moves the tour off it (#177,
 * ADR-0022): the wording of these five cards is unchanged, and the eleven-step
 * script that replaces them is a follow-up.
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

export const TOUR_STEPS: TourStep[] = [
  {
    id: "open-documents",
    anchors: ["open-works", "add-text"],
    title: "Open two documents",
    // "versions", not "manuscripts": the toolbar's Manuscripts button means the
    // physical originals' page images, and these are digitized texts (CONTEXT.md).
    // "your own file ... to read alongside them", never "to search": a Local
    // Document is not searchable, and this step is where a visitor decides what
    // to open (#175).
    body: "Open “Works”, pick a story, and tick the versions you want side by side — or add your own file with “+ Add Text” to read alongside them. Open two of the versions: the next step searches one against the others.",
    // Two, because the next step searches one document against the others: one
    // open document has nothing to be compared with.
    gate: (s) => s.openDocumentCount >= 2,
  },
  {
    id: "select-to-search",
    anchors: ["selection-search"],
    title: "Select text to search",
    body: "Select any text in one document, then click the floating “Search” button that appears beneath it. It searches the other open documents for that text.",
    gate: (s) => s.searchCompleted,
    latchBoundary: true,
  },
  {
    id: "navigate-results",
    anchors: ["result-nav"],
    title: "Move through the results",
    body: "Each column steps through its own matches. Use ← and → to move between them — the text scrolls to each match as you go.",
    gate: (s) => s.resultNavigated,
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
