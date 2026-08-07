import type { TourSignals } from "./tourProgress";

/**
 * The three facts the tour's gates need that no store holds (#178): whether the
 * Works dropdown is open, which work is showing its versions and how many of
 * them are ticked, and whether the reader has selected a passage to search.
 *
 * All three live in component state (`useDismissableDropdown`, WorkPicker's
 * `expandedKey` / `ticked`) or in the browser's selection, and none of them
 * belongs in a store: they are disclosure and transient input, not workspace
 * state anybody else reads. So the tour probes the rendered markup instead —
 * cheap, because the overlay already re-measures its anchors every frame, and
 * honest, because the thing the step asks the reader to do *is* the thing on
 * screen.
 *
 * The cost is a coupling to how those panels render, and it is deliberate: the
 * selectors below are the whole of it, each `data-tour` attribute is placed for
 * exactly one gate, and `tourDomSignals.test.tsx` probes the real panels so a
 * change in their shape fails a test rather than quietly stalling the tour.
 */
export type TourDomSignals = Pick<
  TourSignals,
  "worksDropdownOpen" | "workExpanded" | "versionsTicked" | "passageSelected"
>;

/** Nothing open, nothing ticked, nothing selected. */
export const NO_DOM_SIGNALS: TourDomSignals = {
  worksDropdownOpen: false,
  workExpanded: false,
  versionsTicked: 0,
  passageSelected: false,
};

/**
 * Whether the reader has text selected inside a column's reading pane.
 *
 * Both ends are checked, so a selection that starts in a column and ends in the
 * toolbar does not count — and a collapsed selection (a plain click, which the
 * browser still reports) is not a selection at all.
 */
function passageSelected(root: ParentNode & Node): boolean {
  // A Document has no `ownerDocument` — it is its own — so ask for the right
  // one rather than reading through a property that is null exactly when the
  // probe is running over the real page.
  const doc =
    root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument;
  const selection = doc?.getSelection?.() ?? null;
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  if (selection.toString().trim() === "") return false;
  const range = selection.getRangeAt(0);
  return (
    inColumnText(range.startContainer) && inColumnText(range.endContainer)
  );
}

function inColumnText(node: Node | null): boolean {
  const el = node instanceof Element ? node : node?.parentElement;
  return Boolean(el?.closest('[data-tour="column-text"]'));
}

/**
 * Read the workspace's markup for what the stores cannot say.
 *
 * @param root the tree to probe — the document in the app, a container in tests.
 */
export function probeTourDom(root: ParentNode & Node = document): TourDomSignals {
  const versionList = root.querySelector('[data-tour="version-list"]');
  return {
    worksDropdownOpen: Boolean(root.querySelector('[data-tour="works-panel"]')),
    // The version list only renders under the work that is expanded, so its
    // presence is the answer — no work name and no ordering is involved (#152).
    workExpanded: Boolean(versionList),
    versionsTicked:
      versionList?.querySelectorAll('input[type="checkbox"]:checked').length ??
      0,
    passageSelected: passageSelected(root),
  };
}

export function domSignalsEqual(a: TourDomSignals, b: TourDomSignals): boolean {
  return (
    a.worksDropdownOpen === b.worksDropdownOpen &&
    a.workExpanded === b.workExpanded &&
    a.versionsTicked === b.versionsTicked &&
    a.passageSelected === b.passageSelected
  );
}
