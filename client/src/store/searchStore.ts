import { create } from 'zustand'
import type { SearchResult, SearchResultId } from '../types/search'

interface SearchStore {
  results: SearchResult[]
  selectedResultId: SearchResultId | null
  setResults: (results: SearchResult[]) => void
  setSelectedResultId: (id: SearchResultId | null) => void
}

const initialResults: SearchResult[] = [
  { id: 'r1', label: 'Search result 1', detail: 'Matched lines 120–145' },
  { id: 'r2', label: 'Search result 2', detail: 'Matched lines 300–318' },
  { id: 'r3', label: 'Search result 3', detail: 'Matched lines 980–1004' },
]

export const useSearchStore = create<SearchStore>((set) => ({
  results: initialResults,
  selectedResultId: null,

  setResults: (results) =>
    set({
      results,
    }),

  setSelectedResultId: (id) =>
    set({
      selectedResultId: id,
    }),
}))
