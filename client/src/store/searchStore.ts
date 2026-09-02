import { create } from "zustand";
import type { DocumentId } from "../types/document";
import type { SearchResult } from "../types/search";
import { logEvent } from "../api/log";
import { searchDocument } from "../api/search";
import { captureSearchRun } from "../history/captureSearchRun";

function logParamChange(param: string, from: number, to: number): void {
  if (to === from) return;
  logEvent("search_param_changed", { param, from, to });
}

// same guard-then-log shape as logParamChange, for result navigation
function logResultNavigated(
  action: "next" | "prev",
  from: number,
  to: number,
): void {
  if (to === from) return;
  logEvent("result_navigated", { action, from_index: from, to_index: to });
}

// A copy of a per-document map with one document's entry dropped, so the map
// answers "never searched" for it rather than holding a stale value.
function without<T>(
  map: Record<DocumentId, T>,
  documentId: DocumentId,
): Record<DocumentId, T> {
  return Object.fromEntries(
    Object.entries(map).filter(([id]) => id !== documentId),
  );
}

// Where the query a search ran with came from: the search bar ("typed") or text
// selected inside a TEI viewer ("selection"). Logged on every search_performed.
export type QueryOrigin = "selection" | "typed";

// The four tuning knobs a search runs with. Normally read off the store, but
// carried explicitly by a retry, which replays the values its failed attempt
// used rather than whatever the sliders say now.
export interface SearchParams {
  matchLength: number;
  precision: number;
  dissimilarityScore: number;
  topK: number;
}

// A selection-originated search carries its own query rather than reading the
// search bar's `query` state — the two paths never share mutable state, so
// there is nothing to disambiguate at runtime (ADR-0008).
export interface RunSearchOptions {
  query?: string;
  origin?: QueryOrigin;
  // The document left out of this search because the query was selected in it.
  // Recorded on every `search_performed` the search emits, so a logged search
  // says which documents it could have covered but deliberately did not.
  excludedDocId?: DocumentId | null;
  params?: SearchParams;
}

// Everything one column's search was made of, kept so a retry can re-run that
// exact search. A failed attempt is not reconstructible from current state: a
// selection search's query lives nowhere else (ADR-0008), and the search bar
// and the sliders may have moved on since. Replaying the whole attempt is what
// keeps Retry meaning "that search again" rather than "some search now".
export interface SearchAttempt {
  // the searched document's *server* id, as `runSearch` takes it — unlike
  // `excludedDocId` below, which is a client column id
  docId: number;
  query: string;
  origin: QueryOrigin;
  excludedDocId: DocumentId | null;
  params: SearchParams;
}

// What one column came back with, once its search has settled. The three cases
// are told apart because they are treated differently downstream: a Search
// History snapshot keeps a zero-hit column and leaves an errored one out
// (ADR-0024), and an errored column is the one that offers a Retry (ADR-0012).
export type SearchColumnOutcome = "results" | "zero-hits" | "errored";

// One column a search run targeted: the column on screen, and the server-side
// document behind it.
export interface SearchRunTarget {
  docId: number;
  clientDocId: DocumentId;
}

export type SearchRunColumn = SearchRunTarget & {
  outcome: SearchColumnOutcome;
};

/**
 * One whole search as the user experienced it: the query they searched, its
 * origin, and what every column it fanned across came back with.
 *
 * A run exists only once it has settled — `startSearchRun` resolves with it —
 * so it is the one place that can answer "this search is over, and here is how
 * it went", which no per-column Search Attempt can. A single column's Retry
 * repairs a column inside a run that is already over; it is never a run of its
 * own (ADR-0012).
 */
export interface SearchRun {
  query: string;
  origin: QueryOrigin;
  // The column left unsearched because the query was selected in it, if any.
  excludedDocId: DocumentId | null;
  params: SearchParams;
  // The targeted columns with their settled outcomes, in the order they were
  // searched (which is the order they sit on screen). A column whose state was
  // thrown away mid-flight — closed, or skipped by a later search — drops out:
  // it has no outcome anybody is still waiting for.
  columns: SearchRunColumn[];
}

//this store is used to store the search results/handle search operations for a given document
//the store holds the live search parameters, so `runSearch` can fall back to
//the store itself where a retry hands it a recorded set
interface SearchStore extends SearchParams {
  query: string;
  resultsByDocument: Record<DocumentId, SearchResult[]>; //store the search results for a document
  activeResultIndexByDocument: Record<DocumentId, number>; //store the index of the current result

  setQuery: (query: string) => void;
  setResultsByDocument: (
    results: Record<DocumentId, SearchResult[]>,
  ) => void;
  setActiveResultIndex: (documentId: DocumentId, index: number) => void;
  clearDocumentResults: (documentId: DocumentId) => void;

  setMatchLength: (v: number) => void;
  setPrecision: (v: number) => void;
  setDissimilarityScore: (v: number) => void;
  setTopK: (v: number) => void;

  isSearchingByDocument: Record<DocumentId, boolean>; //per-document loading state
  searchErrorByDocument: Record<DocumentId, boolean>; //per-document error state
  //bumped whenever a document's search state is thrown away, so a response that
  //arrives afterwards can tell that nobody is waiting for it any more
  searchGenerationByDocument: Record<DocumentId, number>;
  //what each column last tried to search for, so its failure can be re-run
  lastAttemptByDocument: Record<DocumentId, SearchAttempt>;
  //the last user-initiated search, once its whole fan-out settled
  lastSearchRun: SearchRun | null;
  //how many search runs have been started, so a run that settles after a later
  //one started can tell that it is no longer the search the user is on
  searchRunCount: number;
  startSearchRun: (
    targets: SearchRunTarget[],
    options?: RunSearchOptions,
  ) => Promise<SearchRun | null>;
  runSearch: (
    docId: number,
    clientDocId: string,
    options?: RunSearchOptions,
  ) => Promise<SearchColumnOutcome | null>;
  retrySearch: (clientDocId: DocumentId) => Promise<void>;

  nextResult: (documentId: DocumentId) => void;
  prevResult: (documentId: DocumentId) => void;
}


export const useSearchStore = create<SearchStore>((set, get) => ({
  //initial state
  query: "",
  resultsByDocument: {},
  activeResultIndexByDocument: {},
  matchLength: 130,
  precision: 1,
  dissimilarityScore: 0.5,
  topK: 10,
  isSearchingByDocument: {},
  searchErrorByDocument: {},
  searchGenerationByDocument: {},
  lastAttemptByDocument: {},
  lastSearchRun: null,
  searchRunCount: 0,

  /**
   * Run one user-initiated search across the given columns, and resolve with it
   * once every one of them has settled.
   *
   * This is the boundary a search has as the *user* made it: the toolbar's
   * Search button and the select-to-search button each start exactly one run,
   * where both used to fire a bare loop of independent per-column calls that
   * nothing could see the end of. The columns are still searched concurrently
   * and write their results in as they land, so nothing on screen waits for the
   * slowest column — the run only adds a vantage point from which the whole
   * search has an end and an outcome.
   *
   * A blank query is not a search: no column is touched and there is no run.
   */
  startSearchRun: async (targets, options = {}) => {
    const state = get();
    const { dissimilarityScore, topK, matchLength, precision } =
      options.params ?? state;
    const query = options.query ?? state.query;
    if (!query.trim()) return null;
    // Which search this is. Runs barely overlap — every control that starts one
    // stands down while a column is searching — but where they do, the record
    // is of the search the user started last, not of whichever settled last.
    const runCount = state.searchRunCount + 1;
    set({ searchRunCount: runCount });
    const origin = options.origin ?? "typed";
    const excludedDocId = options.excludedDocId ?? null;
    // Fixed for the whole run: every column searches the same query with the
    // same parameters, whatever the sliders do while it is in flight.
    const params: SearchParams = {
      matchLength,
      precision,
      dissimilarityScore,
      topK,
    };

    const settled = targets.map((target) =>
      state
        .runSearch(target.docId, target.clientDocId, {
          query,
          origin,
          excludedDocId,
          params,
        })
        .then((outcome) => (outcome ? { ...target, outcome } : null)),
    );
    // The source column of a selection search was skipped, not searched, so it
    // is emptied rather than left showing an earlier search's hits. Done here
    // with the rest of the fan-out: which column this search left out is part
    // of what the run is.
    if (excludedDocId) state.clearDocumentResults(excludedDocId);

    const columns = (await Promise.all(settled)).filter(
      (column) => column !== null,
    );
    const run: SearchRun = {
      query,
      origin,
      excludedDocId,
      params,
      columns,
    };
    // A run that a later one has already superseded is neither the search the user
    // is on nor the one whose results are still in the columns, so it is neither
    // recorded here nor captured to history.
    if (get().searchRunCount === runCount) {
      set({ lastSearchRun: run });
      // The one place a Search History entry is captured from (#187, ADR-0024): a whole
      // user-initiated search, at the moment it settled, with the results as they stand
      // right now. Signed-out visitors and all-errored searches are declined inside.
      captureSearchRun(run, get().resultsByDocument);
    }
    return run;
  },

  //run the search
    runSearch: async (docId, clientDocId, options = {}) => {
      const state = get();
      const { dissimilarityScore, topK, matchLength, precision } =
        options.params ?? state;
      const query = options.query ?? state.query;
      const queryOrigin = options.origin ?? "typed";
      const excludedDocId = options.excludedDocId ?? null;
      if (!query.trim()) return null;
      set((s) => ({
        // Recorded before the request goes out, so a failure always has an
        // attempt to replay — including the one a retry itself made.
        lastAttemptByDocument: {
          ...s.lastAttemptByDocument,
          [clientDocId]: {
            docId,
            query,
            origin: queryOrigin,
            excludedDocId,
            params: { matchLength, precision, dissimilarityScore, topK },
          },
        },
        isSearchingByDocument: { ...s.isSearchingByDocument, [clientDocId]: true },
        resultsByDocument: { ...s.resultsByDocument, [clientDocId]: [] },
        activeResultIndexByDocument: { ...s.activeResultIndexByDocument, [clientDocId]: 0 },
        searchErrorByDocument: { ...s.searchErrorByDocument, [clientDocId]: false },
      }));
      // What this column counted as "current" when the request went out. If a
      // clear bumps it while we are awaiting, the response belongs to a search
      // that has since been declared over, and writing it back would refill a
      // column we just emptied.
      const generation = get().searchGenerationByDocument[clientDocId] ?? 0;
      const superseded = () =>
        (get().searchGenerationByDocument[clientDocId] ?? 0) !== generation;
      const windowSizeRatio = matchLength / 100;
      const startedAt = performance.now();
      const searchPerformedBase = {
        query,
        query_origin: queryOrigin,
        excluded_doc_id: excludedDocId,
        window_size_ratio: windowSizeRatio,
        step_size: precision,
        dissimilarity_threshold: dissimilarityScore,
        top_k: topK,
      };
      try {
        const results = await searchDocument({
          docId,
          query,
          topK,
          dissimilarityThreshold: dissimilarityScore,
          windowSizeRatio,
          stepSize: precision,
        });
        logEvent("search_performed", {
          ...searchPerformedBase,
          result_count: results.length,
          latency_ms: performance.now() - startedAt,
          error: false,
        });
        if (superseded()) return null;
        set((s) => ({
          resultsByDocument: { ...s.resultsByDocument, [clientDocId]: results },
          // on the documents we've opened, which result should be highlighted and displayed?
          activeResultIndexByDocument: { ...s.activeResultIndexByDocument, [clientDocId]: 0 },
          isSearchingByDocument: { ...s.isSearchingByDocument, [clientDocId]: false },
          searchErrorByDocument: { ...s.searchErrorByDocument, [clientDocId]: false },
        }));
        return results.length > 0 ? "results" : "zero-hits";
      } catch (e) {
        console.error(e);
        logEvent("search_performed", {
          ...searchPerformedBase,
          result_count: 0,
          latency_ms: performance.now() - startedAt,
          error: true,
        });
        if (superseded()) return null;
        set((s) => ({
          isSearchingByDocument: { ...s.isSearchingByDocument, [clientDocId]: false },
          searchErrorByDocument: { ...s.searchErrorByDocument, [clientDocId]: true },
        }));
        return "errored";
      }
    },

  // Re-run one column's last attempt, exactly as it was made. Every other
  // column is left alone: this is one `runSearch` call, and `runSearch` only
  // ever writes into the column it was given.
  //
  // A column with nothing recorded has nothing to replay, and a column already
  // searching owns its request — the retry affordance is hidden behind the
  // loading state anyway, so both cases simply decline rather than reporting.
  //
  // What it deliberately does not touch is the query source highlight a
  // selection search leaves on its source text (ADR-0008): that mark belongs to
  // whatever search the workspace last ran, and a retry of one column is not a
  // reason to move it — least of all back onto text a later search has moved on
  // from.
  retrySearch: async (clientDocId) => {
    const state = get();
    const attempt = state.lastAttemptByDocument[clientDocId];
    if (!attempt) return;
    if (state.isSearchingByDocument[clientDocId]) return;
    // Straight to `runSearch`, deliberately: a Retry repairs one column of a
    // search that is already over, so it is not a search run of its own and
    // leaves `lastSearchRun` alone (ADR-0012).
    await state.runSearch(attempt.docId, clientDocId, {
      query: attempt.query,
      origin: attempt.origin,
      excludedDocId: attempt.excludedDocId,
      params: attempt.params,
    });
  },

  setQuery: (query) =>
    set({
      query,
    }),

  setResultsByDocument: (results) =>
    set({
      resultsByDocument: results,
    }),

  // Put a document back to "not searched": drop the results, the active index,
  // the error flag, the loading flag, and the attempt a retry would have
  // replayed. Used for a document a
  // search deliberately skipped — leaving its keys in place would show an
  // earlier, unrelated search's hits as if they belonged to this one.
  //
  // Bumping the generation covers the case where that earlier search is still
  // in flight: it finds itself superseded and drops its response instead of
  // refilling the column.
  clearDocumentResults: (documentId) =>
    set((state) => ({
      resultsByDocument: without(state.resultsByDocument, documentId),
      activeResultIndexByDocument: without(
        state.activeResultIndexByDocument,
        documentId,
      ),
      searchErrorByDocument: without(state.searchErrorByDocument, documentId),
      isSearchingByDocument: without(state.isSearchingByDocument, documentId),
      lastAttemptByDocument: without(state.lastAttemptByDocument, documentId),
      searchGenerationByDocument: {
        ...state.searchGenerationByDocument,
        [documentId]: (state.searchGenerationByDocument[documentId] ?? 0) + 1,
      },
    })),

  setActiveResultIndex: (documentId, index) =>
    set((state) => {
      const docResults = state.resultsByDocument[documentId] ?? [];

      if (docResults.length === 0) {
        return state;
      }

      const safeIndex = Math.max(
        0,
        Math.min(index, docResults.length - 1),
      );

      return {
        activeResultIndexByDocument: {
          ...state.activeResultIndexByDocument,
          [documentId]: safeIndex,
        },
      };
    }),

  setMatchLength: (v) => {
    logParamChange("match_length", get().matchLength, v);
    set({ matchLength: v });
  },
  setPrecision: (v) => {
    logParamChange("precision", get().precision, v);
    set({ precision: v });
  },
  setDissimilarityScore: (v) => {
    logParamChange("dissimilarity_score", get().dissimilarityScore, v);
    set({ dissimilarityScore: v });
  },
  setTopK: (v) => {
    logParamChange("top_k", get().topK, v);
    set({ topK: v });
  },

  nextResult: (documentId) =>
    set((state) => {
      const docResults = state.resultsByDocument[documentId] ?? [];
      const currentIndex =
        state.activeResultIndexByDocument[documentId] ?? 0;

      if (docResults.length === 0) {
        return state;
      }

      const nextIndex =
        currentIndex < docResults.length - 1
          ? currentIndex + 1
          : currentIndex;

      logResultNavigated("next", currentIndex, nextIndex);

      return {
        activeResultIndexByDocument: {
          ...state.activeResultIndexByDocument,
          [documentId]: nextIndex,
        },
      };
    }),

  prevResult: (documentId) =>
    set((state) => {
      const docResults = state.resultsByDocument[documentId] ?? [];
      const currentIndex =
        state.activeResultIndexByDocument[documentId] ?? 0;

      if (docResults.length === 0) {
        return state;
      }

      const prevIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;

      logResultNavigated("prev", currentIndex, prevIndex);

      return {
        activeResultIndexByDocument: {
          ...state.activeResultIndexByDocument,
          [documentId]: prevIndex,
        },
      };
    }),
}));

// Is a search running on any column, whichever control fired it? Everything
// that has to stand aside for a search in flight — the tool bar's own Search
// button, the select-to-search trigger — asks this one question, so the shape
// of the per-document loading state stays the store's business.
export const selectAnySearching = (state: SearchStore): boolean =>
  Object.values(state.isSearchingByDocument).some(Boolean);
