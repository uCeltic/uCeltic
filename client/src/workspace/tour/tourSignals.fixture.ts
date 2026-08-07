import type { TourSignals } from "./tourProgress";

/**
 * A workspace nobody has touched yet — the starting point every tour test
 * builds from, so a new signal is added in one place rather than in each of
 * them.
 */
export const NOTHING_DONE: TourSignals = {
  worksDropdownOpen: false,
  workExpanded: false,
  versionsTicked: 0,
  openDocumentCount: 0,
  passageSelected: false,
  searchFired: false,
  searchCompleted: false,
  resultNavigated: false,
  columnsReordered: false,
  fontSizeChanged: false,
};

/** That workspace with some of it done. */
export const signals = (over: Partial<TourSignals> = {}): TourSignals => ({
  ...NOTHING_DONE,
  ...over,
});
