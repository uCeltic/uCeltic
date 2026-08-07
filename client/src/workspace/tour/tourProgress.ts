import type { TourStep } from "./tourSteps";

/**
 * Which step of the guided tour is showing, derived from what the reader has
 * actually done in the workspace (#177, ADR-0022).
 *
 * The whole mechanism is here, as pure functions over a snapshot of workspace
 * state: the overlay never has to be mounted to say which step a workspace is
 * at, and the rules below are asserted directly rather than through a rendered
 * card.
 *
 * Three rules, in the order they apply:
 *
 * 1. **Derivation.** Every step declares a gate — "this step's action has
 *    happened". The derived step is the first one whose gate is unsatisfied.
 *    The last step declares none, so derivation stops there.
 * 2. **Latching.** Before any search has completed, gates read live state, so
 *    the tour follows the workspace backwards as well as forwards. Once a
 *    search has completed, every step up to it latches for good, and each later
 *    step latches on its own as its action happens — moving through results and
 *    changing the text size are reversible, and undoing one must not un-teach
 *    it.
 * 3. **The manual pointer.** Not here: the store keeps it, and shows
 *    `max(derived, manual)`, so Next can always jump a step the reader does not
 *    want to perform.
 */

/**
 * A snapshot of the workspace, as the gates read it.
 *
 * Assembled from two places, because the workflow the tour walks is not all
 * held in stores: `tourSignals.ts` reads the stores, and `tourDomSignals.ts`
 * probes the rendered panels for the three facts no store keeps (#178).
 * Nothing in this module knows that either exists.
 */
export interface TourSignals {
  /** The Works dropdown is open. Probed: no store holds it. */
  worksDropdownOpen: boolean;
  /** Some work in the Works dropdown is showing its versions. Probed. */
  workExpanded: boolean;
  /** How many versions are ticked in the expanded work. Probed. */
  versionsTicked: number;
  /** How many open documents are Versions — TEI witnesses a search can reach. */
  openVersionCount: number;
  /** Text is selected inside a column's reading pane. Probed. */
  passageSelected: boolean;
  /**
   * A select-to-search has been fired from at least one column — recorded the
   * moment the request goes out, so this is true while it is still in flight.
   * A typed toolbar search is not one (ADR-0008).
   */
  selectionSearchFired: boolean;
  /**
   * At least one column's select-to-search ran to completion — any number of
   * matches, including none. A search that errored does not count: the column
   * offers its own Retry, and the reader has not yet seen what a search does.
   */
  selectionSearchCompleted: boolean;
  /** At least one column is sitting on something other than its first match. */
  resultNavigated: boolean;
  /** The columns are no longer in the order they were opened in. */
  columnsReordered: boolean;
  /** The reading text is no longer at the size it started at. */
  fontSizeChanged: boolean;
}

/** Nothing taught yet — the latch state a fresh tour starts from. */
export const NO_LATCHES: readonly boolean[] = Object.freeze([]);

function isSatisfied(step: TourStep, signals: TourSignals): boolean {
  // A step with no gate names no action, so nothing can satisfy it: derivation
  // stops there and the reader moves on with Next.
  return step.gate ? step.gate(signals) : false;
}

/** The step that closes the rewindable stretch — the one the search comes back to. */
function boundaryIndex(steps: TourStep[]): number {
  return steps.findIndex((step) => step.latchBoundary);
}

/**
 * The latch state after this snapshot: what the tour must go on treating as
 * taught even if the reader undoes it.
 *
 * Always the full-length array, so a caller can index any step without
 * wondering whether the tour has got that far yet.
 */
export function latchProgress(
  steps: TourStep[],
  signals: TourSignals,
  latched: readonly boolean[],
): boolean[] {
  const boundary = boundaryIndex(steps);
  const searchDone = boundary >= 0 && isSatisfied(steps[boundary], signals);
  return steps.map((step, i) => {
    if (latched[i]) return true;
    // Before the search, nothing latches: the tour is still following live
    // state in both directions.
    if (!searchDone) return false;
    return i <= boundary || isSatisfied(step, signals);
  });
}

/**
 * The step the workspace itself is asking for.
 *
 * Latches are re-derived from `signals` first, so a caller that has not yet
 * written back the latch state still gets the right step for this snapshot.
 */
export function deriveStepIndex(
  steps: TourStep[],
  signals: TourSignals,
  latched: readonly boolean[],
): number {
  const effective = latchProgress(steps, signals, latched);
  const index = steps.findIndex(
    (step, i) => !effective[i] && !isSatisfied(step, signals),
  );
  return index === -1 ? steps.length - 1 : index;
}

/**
 * The step actually on screen: `max(derived, manual)`.
 *
 * The manual pointer only ever moves on Next and Back, and taking the larger of
 * the two is what keeps the tour from trapping anyone — Next can always jump a
 * step whose action the reader does not want to perform, and no gate can pull
 * the card back to it afterwards.
 */
export function visibleStepIndex(
  steps: TourStep[],
  signals: TourSignals,
  latched: readonly boolean[],
  manualIndex: number,
): number {
  const derived = deriveStepIndex(steps, signals, latched);
  return Math.max(derived, Math.min(manualIndex, steps.length - 1));
}

/**
 * What re-opening the tour from Help teaches again: everything after the search
 * step. The steps up to it stay latched, so a reader who already has two
 * documents open and a search behind them is taught from where they are rather
 * than sent back to open documents they have already opened. The workspace
 * itself is untouched — this only forgets what the tour had taught.
 */
export function clearLatchesAfterBoundary(
  steps: TourStep[],
  latched: readonly boolean[],
): boolean[] {
  const boundary = boundaryIndex(steps);
  return steps.map((_, i) => (i <= boundary ? Boolean(latched[i]) : false));
}
