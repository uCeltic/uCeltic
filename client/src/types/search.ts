import type { DocumentId } from './document'

export type SearchResultId = string

export interface SearchResult {
  id: SearchResultId
  label: string
  detail: string
  documentId?: DocumentId
}