// define the search result
export interface SearchResult {
  score: number;
  snippet: string;
  word_start: number;
  word_end: number;
  anchor_id: number | null;
  anchor_tag: string | null;
  line_no: string | null;
}