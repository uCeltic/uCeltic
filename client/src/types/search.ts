
export interface SearchResult {
  score: number;
  snippet: string;
  match_start: number;
  match_end: number;
  anchor_id: number | null;
  anchor_tag: string | null;
  line_no: string | null;
  highlight_anchor_ids: number[];
}