import { csrfHeaders, ensureCsrfToken } from "./csrf";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const SEARCH_HISTORY_URL = `${API_BASE}/search-history/`;

/** One matched passage, as it came back. `score` is a *dissimilarity* (0 = identical) and
 *  is stored raw — a reader turns it into a match percentage, `(1 − score) × 100 %`. */
export interface SearchHistoryHit {
  snippet: string;
  score: number;
}

/** One column that returned. The Version's title is frozen as text: an entry holds no
 *  reference to a TEI Document, so a rename or a deletion cannot reach it (ADR-0024). */
export interface SearchHistoryVersion {
  title: string;
  hits: SearchHistoryHit[];
}

/** The snapshot of one settled search, in the wire shape the endpoint takes. Parameter
 *  names are the search API's, not the UI's — "Match Length" is window_size_ratio. */
export interface SearchHistoryEntry {
  query: string;
  query_origin: "selection" | "typed";
  window_size_ratio: number;
  step_size: number;
  dissimilarity_threshold: number;
  top_k: number;
  versions: SearchHistoryVersion[];
}

/**
 * Store one settled search on the signed-in user's history (#187).
 *
 * Fire-and-forget, like `logEvent` and unlike `submitFeedback`: nobody asked for this
 * save and nobody is waiting on it, so a failure must not surface — the search itself
 * succeeded, and the entry is a by-product. The rolling 50-entry cap means a lost one is
 * a lost row, not a lost result.
 *
 * The CSRF cookie is awaited rather than read straight from the cookie jar: this endpoint
 * is signed-in only, so the request always carries a session and Django always
 * CSRF-checks it.
 */
export async function saveSearchHistoryEntry(
  entry: SearchHistoryEntry,
): Promise<void> {
  try {
    await ensureCsrfToken();
    await fetch(SEARCH_HISTORY_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(entry),
    });
  } catch {
    // Offline, or the server never answered. Either way there is nothing to tell the
    // visitor: they did not ask for this save.
  }
}
