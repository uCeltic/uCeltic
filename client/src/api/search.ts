import type { SearchResult } from "../types/search";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface SearchParams {
  docId: number;
  query: string;
  topK?: number;
  dissimilarityThreshold?: number;
  windowSizeRatio?: number;
  stepSize?: number;
}

export async function searchDocument(p: SearchParams): Promise<SearchResult[]> {
  const res = await fetch(`${API_BASE}/search/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      doc_id: p.docId,
      query: p.query,
      top_k: p.topK ?? 10,
      dissimilarity_threshold: p.dissimilarityThreshold ?? 0.5,
      window_size_ratio: p.windowSizeRatio ?? 0.5,
      step_size: p.stepSize ?? 1,
    }),
  });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  const data = await res.json();
  return data.results;
}