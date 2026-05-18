import { create } from "zustand";
import type { DocumentId } from "../types/document";
import type { SearchResult } from "../types/search";

interface SearchStore {
  query: string;
  resultsByDocument: Record<DocumentId, SearchResult[]>;
  activeResultIndexByDocument: Record<DocumentId, number>;

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

  isSearching: boolean;
  runSearch: (docId: number, clientDocId: string) => Promise<void>;

  nextResult: (documentId: DocumentId) => void;
  prevResult: (documentId: DocumentId) => void;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",
  resultsByDocument: {},
  activeResultIndexByDocument: {},
  matchLength: 100,
  precision: 1,
  dissimilarityScore: 0.5,
  topK: 10,
  isSearching: false,
    runSearch: async (docId, clientDocId) => {
      const { query, dissimilarityScore, topK, matchLength, precision } = get();
      if (!query.trim()) return;
      set({ isSearching: true });
      try {
        const { searchDocument } = await import("../api/search");
        const results = await searchDocument({
          docId,
          query,
          topK,
          dissimilarityThreshold: dissimilarityScore,
          windowSizeRatio: matchLength / 100,
          stepSize: precision,
        });
        set((s) => ({
          resultsByDocument: { ...s.resultsByDocument, [clientDocId]: results },
          activeResultIndexByDocument: { ...s.activeResultIndexByDocument, [clientDocId]: 0 },
          isSearching: false,
        }));
      } catch (e) {
        console.error(e);
        set({ isSearching: false });
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

  setMatchLength: (v) => set({ matchLength: v }),
  setPrecision: (v) => set({ precision: v }),
  setDissimilarityScore: (v) => set({ dissimilarityScore: v }),
  setTopK: (v) => set({ topK: v }),

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
