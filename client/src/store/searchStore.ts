import { create } from "zustand";
import type { DocumentId } from "../types/document";
import type { SearchResult } from "../types/search";
import { logEvent } from "../api/log";

//this store is used to store the search results/handle search operations for a given document
interface SearchStore {
  query: string;
  resultsByDocument: Record<DocumentId, SearchResult[]>; //store the search results for a document
  activeResultIndexByDocument: Record<DocumentId, number>; //store the index of the current result
  //search parameters
  matchLength: number; 
  precision: number;
  dissimilarityScore: number;
  topK: number;

  setQuery: (query: string) => void;
  setResultsByDocument: (
    results: Record<DocumentId, SearchResult[]>,
  ) => void;
  setActiveResultIndex: (documentId: DocumentId, index: number) => void;

  setMatchLength: (v: number) => void;
  setPrecision: (v: number) => void;
  setDissimilarityScore: (v: number) => void;
  setTopK: (v: number) => void;

  isSearchingByDocument: Record<DocumentId, boolean>; //per-document loading state
  searchErrorByDocument: Record<DocumentId, boolean>; //per-document error state
  runSearch: (docId: number, clientDocId: string) => Promise<void>;

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
  //run the search
    runSearch: async (docId, clientDocId) => {
      const { query, dissimilarityScore, topK, matchLength, precision } = get();
      if (!query.trim()) return;
      set((s) => ({
        isSearchingByDocument: { ...s.isSearchingByDocument, [clientDocId]: true },
        resultsByDocument: { ...s.resultsByDocument, [clientDocId]: [] },
        activeResultIndexByDocument: { ...s.activeResultIndexByDocument, [clientDocId]: 0 },
        searchErrorByDocument: { ...s.searchErrorByDocument, [clientDocId]: false },
      }));
      const windowSizeRatio = matchLength / 100;
      const startedAt = performance.now();
      try {
        const { searchDocument } = await import("../api/search");
        const results = await searchDocument({
          docId,
          query,
          topK,
          dissimilarityThreshold: dissimilarityScore,
          windowSizeRatio,
          stepSize: precision,
        });
        logEvent("search_performed", {
          query,
          window_size_ratio: windowSizeRatio,
          step_size: precision,
          dissimilarity_threshold: dissimilarityScore,
          top_k: topK,
          result_count: results.length,
          latency_ms: performance.now() - startedAt,
          error: false,
        });
        set((s) => ({
          resultsByDocument: { ...s.resultsByDocument, [clientDocId]: results },
          // on the documents we've opened, which result should be highlighted and displayed?
          activeResultIndexByDocument: { ...s.activeResultIndexByDocument, [clientDocId]: 0 },
          isSearchingByDocument: { ...s.isSearchingByDocument, [clientDocId]: false },
          searchErrorByDocument: { ...s.searchErrorByDocument, [clientDocId]: false },
        }));
      } catch (e) {
        console.error(e);
        logEvent("search_performed", {
          query,
          window_size_ratio: windowSizeRatio,
          step_size: precision,
          dissimilarity_threshold: dissimilarityScore,
          top_k: topK,
          result_count: 0,
          latency_ms: performance.now() - startedAt,
          error: true,
        });
        set((s) => ({
          isSearchingByDocument: { ...s.isSearchingByDocument, [clientDocId]: false },
          searchErrorByDocument: { ...s.searchErrorByDocument, [clientDocId]: true },
        }));
      }
    },
  setQuery: (query) =>
    set({
      query,
    }),

  setResultsByDocument: (results) =>
    set({
      resultsByDocument: results,
    }),

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
    const from = get().matchLength;
    if (v === from) return;
    logEvent("search_param_changed", { param: "match_length", from, to: v });
    set({ matchLength: v });
  },
  setPrecision: (v) => {
    const from = get().precision;
    if (v === from) return;
    logEvent("search_param_changed", { param: "precision", from, to: v });
    set({ precision: v });
  },
  setDissimilarityScore: (v) => {
    const from = get().dissimilarityScore;
    if (v === from) return;
    logEvent("search_param_changed", {
      param: "dissimilarity_score",
      from,
      to: v,
    });
    set({ dissimilarityScore: v });
  },
  setTopK: (v) => {
    const from = get().topK;
    if (v === from) return;
    logEvent("search_param_changed", { param: "top_k", from, to: v });
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

      return {
        activeResultIndexByDocument: {
          ...state.activeResultIndexByDocument,
          [documentId]: prevIndex,
        },
      };
    }),
}));
