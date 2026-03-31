import { create } from 'zustand'
import type { ManuscriptId } from '../types/manuscript'
import type { SearchResult } from '../types/search'



interface SearchStore {
  query: string
  resultsByManuscript: Record<ManuscriptId, SearchResult[]>
  activeResultIndexByManuscript: Record<ManuscriptId, number>
  setQuery: (query: string) => void
  setResultsByManuscript: (
    results: Record<ManuscriptId, SearchResult[]>,
  ) => void
  setActiveResultIndex: (manuscriptId: ManuscriptId, index: number) => void
  nextResult: (manuscriptId: ManuscriptId) => void
  prevResult: (manuscriptId: ManuscriptId) => void
}

const initialResultsByManuscript: Record<ManuscriptId, SearchResult[]> = {
  'ms-1': [
    {
      id: 'ms1-r1',
      manuscriptId: 'ms-1',
      lineStart: 300,
      lineEnd: 318,
      score: 0.87,
      content:
        'Full result content for manuscript 1. This area should preserve the full text rather than truncating it with ellipsis. If the result content becomes long, the card body itself can scroll internally without breaking the overall workspace layout.',
    },
    {
      id: 'ms1-r2',
      manuscriptId: 'ms-1',
      lineStart: 512,
      lineEnd: 536,
      score: 0.81,
      content:
        'Another result for manuscript 1. In the future, each manuscript column will have its own active result and its own result navigation state.',
    },
  ],
  'ms-2': [
    {
      id: 'ms2-r1',
      manuscriptId: 'ms-2',
      lineStart: 120,
      lineEnd: 145,
      score: 0.78,
      content:
        'Result content for manuscript 2. This demonstrates that each manuscript column can own a separate result set and a separate active index.',
    },
  ],
  'ms-3': [
    {
      id: 'ms3-r1',
      manuscriptId: 'ms-3',
      lineStart: 980,
      lineEnd: 1004,
      score: 0.91,
      content:
        'Result content for manuscript 3. Later this can be replaced with real search output from the backend.',
    },
  ],
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: '',
  resultsByManuscript: initialResultsByManuscript,
  activeResultIndexByManuscript: {
    'ms-1': 0,
    'ms-2': 0,
    'ms-3': 0,
  },

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
      const manuscriptResults = state.resultsByManuscript[manuscriptId] ?? []

      if (manuscriptResults.length === 0) {
        return state
      }

      const safeIndex = Math.max(0, Math.min(index, manuscriptResults.length - 1))

      return {
        activeResultIndexByManuscript: {
          ...state.activeResultIndexByManuscript,
          [manuscriptId]: safeIndex,
        },
      }
    }),

  nextResult: (manuscriptId) =>
    set((state) => {
      const manuscriptResults = state.resultsByManuscript[manuscriptId] ?? []
      const currentIndex = state.activeResultIndexByManuscript[manuscriptId] ?? 0

      if (manuscriptResults.length === 0) {
        return state
      }

      const nextIndex =
        currentIndex < manuscriptResults.length - 1 ? currentIndex + 1 : currentIndex

      return {
        activeResultIndexByManuscript: {
          ...state.activeResultIndexByManuscript,
          [manuscriptId]: nextIndex,
        },
      }
    }),

  prevResult: (manuscriptId) =>
    set((state) => {
      const manuscriptResults = state.resultsByManuscript[manuscriptId] ?? []
      const currentIndex = state.activeResultIndexByManuscript[manuscriptId] ?? 0

      if (manuscriptResults.length === 0) {
        return state
      }

      const prevIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex

      return {
        activeResultIndexByManuscript: {
          ...state.activeResultIndexByManuscript,
          [manuscriptId]: prevIndex,
        },
      }
    }),
}))