import { create } from "zustand";
import type { ManuscriptId } from "../types/manuscript";
import type { SearchResult } from "../types/search";

interface SearchStore {
  query: string;
  resultsByManuscript: Record<ManuscriptId, SearchResult[]>;
  activeResultIndexByManuscript: Record<ManuscriptId, number>;

  matchLength: number;
  precision: number;
  dissimilarityScore: number;
  topK: number;

  setQuery: (query: string) => void;
  setResultsByManuscript: (
    results: Record<ManuscriptId, SearchResult[]>,
  ) => void;
  setActiveResultIndex: (manuscriptId: ManuscriptId, index: number) => void;

  setMatchLength: (v: number) => void;
  setPrecision: (v: number) => void;
  setDissimilarityScore: (v: number) => void;
  setTopK: (v: number) => void;

  nextResult: (manuscriptId: ManuscriptId) => void;
  prevResult: (manuscriptId: ManuscriptId) => void;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",
  resultsByManuscript: {},
  activeResultIndexByManuscript: {},
  matchLength: 100,
  precision: 1,
  dissimilarityScore: 0.5,
  topK: 10,
  setQuery: (query) =>
    set({
      query,
    }),

  setResultsByManuscript: (results) =>
    set({
      resultsByManuscript: results,
    }),

  setActiveResultIndex: (manuscriptId, index) =>
    set((state) => {
      const manuscriptResults = state.resultsByManuscript[manuscriptId] ?? [];

      if (manuscriptResults.length === 0) {
        return state;
      }

      const safeIndex = Math.max(
        0,
        Math.min(index, manuscriptResults.length - 1),
      );

      return {
        activeResultIndexByManuscript: {
          ...state.activeResultIndexByManuscript,
          [manuscriptId]: safeIndex,
        },
      };
    }),

  setMatchLength: (v) => set({ matchLength: v }),
  setPrecision: (v) => set({ precision: v }),
  setDissimilarityScore: (v) => set({ dissimilarityScore: v }),
  setTopK: (v) => set({ topK: v }),

  nextResult: (manuscriptId) =>
    set((state) => {
      const manuscriptResults = state.resultsByManuscript[manuscriptId] ?? [];
      const currentIndex =
        state.activeResultIndexByManuscript[manuscriptId] ?? 0;

      if (manuscriptResults.length === 0) {
        return state;
      }

      const nextIndex =
        currentIndex < manuscriptResults.length - 1
          ? currentIndex + 1
          : currentIndex;

      return {
        activeResultIndexByManuscript: {
          ...state.activeResultIndexByManuscript,
          [manuscriptId]: nextIndex,
        },
      };
    }),

  prevResult: (manuscriptId) =>
    set((state) => {
      const manuscriptResults = state.resultsByManuscript[manuscriptId] ?? [];
      const currentIndex =
        state.activeResultIndexByManuscript[manuscriptId] ?? 0;

      if (manuscriptResults.length === 0) {
        return state;
      }

      const prevIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;

      return {
        activeResultIndexByManuscript: {
          ...state.activeResultIndexByManuscript,
          [manuscriptId]: prevIndex,
        },
      };
    }),
}));
