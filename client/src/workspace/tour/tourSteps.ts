/**
 * The first-run spotlight tour (#125): a single select-to-search walkthrough.
 *
 * Each step points at one or more live anchors by their `data-tour` attribute.
 * The elements carrying these attributes live in ToolBar, TEIPickerDropdown,
 * SelectionSearchButton, HamburgerMenu, and DocumentArea — keep the ids here in
 * step with the markup there.
 *
 * A step may name several selectors: the spotlight rings the box that encloses
 * all of them (step 1 rings `Open TEI` and `+ Add Text` together). A selector
 * that matches nothing right now — the floating select-to-search button before
 * any text is selected, the result nav before any search has run — is simply not
 * ringed; the card still shows, because the tour is non-blocking and the user is
 * expected to perform the very action that brings that anchor on screen.
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
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "open-documents",
    anchors: ["open-tei", "add-text"],
    title: "Open two documents",
    body: "Open a text from the built-in corpus with “Open TEI”, and add your own file with “+ Add Text”. Open two — the next step searches one against the others.",
  },
  {
    id: "select-to-search",
    anchors: ["selection-search"],
    title: "Select text to search",
    body: "Select any text in one document, then click the floating “Search” button that appears beneath it. It searches the other open documents for that text.",
  },
  {
    id: "navigate-results",
    anchors: ["result-nav"],
    title: "Move through the results",
    body: "Each column steps through its own matches. Use ← and → to move between them — the text scrolls to each match as you go.",
  },
  {
    id: "font-size",
    anchors: ["menu"],
    title: "Change the text size",
    body: "Open this menu to make the text larger or smaller with the A− and A+ controls.",
  },
  {
    id: "manuscripts",
    anchors: ["manuscripts"],
    title: "Show or hide manuscripts",
    body: "Toggle the manuscript images panel on or off with this button. That's the tour — happy searching!",
  },
];
