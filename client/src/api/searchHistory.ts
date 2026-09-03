import { csrfHeaders, ensureCsrfToken } from "./csrf";
import type { SearchWireParams } from "./searchParams";

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

/** The snapshot of one settled search, in the wire shape the endpoint takes. The four
 *  parameters ride along under the search API's names, not the UI's — "Match Length" is
 *  window_size_ratio. */
export interface SearchHistoryEntry extends SearchWireParams {
  query: string;
  // Mirrors the server-side allow-set QUERY_ORIGINS in apps/history/models.py; anything
  // else is a 400. A Retry is neither of these — it never reaches this endpoint.
  query_origin: "selection" | "typed";
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
    const response = await fetch(SEARCH_HISTORY_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(entry),
    });
    // Nothing for the visitor here either, but a *refused* snapshot is a different thing
    // from a dropped one: it means what we sent does not fit what the endpoint accepts,
    // and silence would let every search stop being recorded with no sign anywhere.
    if (!response.ok) {
      console.error(`search history not saved: ${response.status}`);
    }
  } catch {
    // Offline, or the server never answered. Either way there is nothing to tell the
    // visitor: they did not ask for this save.
  }
}

/** One entry as it comes back from the store: the snapshot the user sent, plus the two
 *  fields only the server knows — the `id` a later delete (#189) or export (#190)
 *  addresses it by, and the moment it was searched. */
export interface StoredSearchHistoryEntry extends SearchHistoryEntry {
  id: number;
  created_at: string;
}

/** The history could not be *read*. Named for the read path alone: a failed save never
 *  throws — nobody asked for it — where a failed read is the visitor's business, because
 *  they opened their profile to look at it. */
export class SearchHistoryReadError extends Error {}

/**
 * Read the signed-in user's own Search History, newest first (#188).
 *
 * Whose history this is never travels in the request — the session cookie decides, and
 * the endpoint filters by it. No CSRF dance: this is a GET, which Django does not check.
 *
 * The entries come back as they were stored, `score` still the raw dissimilarity; the
 * component that shows a hit is what turns it into a match percentage (ADR-0024).
 */
export async function fetchSearchHistory(): Promise<StoredSearchHistoryEntry[]> {
  const response = await fetch(SEARCH_HISTORY_URL, { credentials: "same-origin" });
  if (!response.ok) {
    throw new SearchHistoryReadError(`search history not read: ${response.status}`);
  }
  return response.json();
}

/** An entry, or the whole history, could not be *removed*. Kept apart from
 *  `SearchHistoryReadError` because the two failures are told differently: a read that
 *  fails leaves the list empty and unexplained, where a delete that fails leaves entries
 *  the user believes they just got rid of. */
export class SearchHistoryDeleteError extends Error {}

/** The one DELETE both removals are: same method, same credentials, same CSRF dance —
 *  only the address and what to say when it fails differ. Whose entries go is never in
 *  the request; the endpoint scopes every removal to the session's user. */
async function deleteAt(url: string, failure: string): Promise<void> {
  await ensureCsrfToken();
  const response = await fetch(url, {
    method: "DELETE",
    credentials: "same-origin",
    headers: csrfHeaders(),
  });
  if (!response.ok) {
    throw new SearchHistoryDeleteError(`${failure}: ${response.status}`);
  }
}

/**
 * Delete one entry from the signed-in user's own history (#189).
 *
 * An id belonging to somebody else is a 404 like any other unknown id — whether a given
 * entry exists is not this user's business.
 *
 * Unlike the capture this one throws. Nobody asked to be saved, but the user *did* ask to
 * delete, and a silent failure would leave an entry on screen after the confirm as if the
 * list had simply not updated.
 */
export async function deleteSearchHistoryEntry(id: number): Promise<void> {
  await deleteAt(`${SEARCH_HISTORY_URL}${id}/`, `entry ${id} not deleted`);
}

/**
 * Clear the signed-in user's entire history (#189).
 *
 * "Everything" is decided by the session, not by a list of ids the client assembles: so a
 * stale page cannot ask for someone else's rows, and a search captured between the read
 * and this call goes too — which is what the user asked for.
 */
export async function clearSearchHistory(): Promise<void> {
  await deleteAt(SEARCH_HISTORY_URL, "search history not cleared");
}

/** The export of a single entry failed. Its own error, not `SearchHistoryReadError`:
 *  reading the list happens because the page opened, where an export happens because the
 *  user clicked asking for a file, and only one of those can be reported as such. */
export class SearchHistoryExportError extends Error {}

/** What the file is called if the response says nothing. Only a fallback — the backend
 *  names the file after the moment searched, which is what sorts a folder of exports. */
const FALLBACK_EXPORT_FILENAME = "search.docx";

function filenameFrom(disposition: string | null): string {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? FALLBACK_EXPORT_FILENAME;
}

/**
 * Export one entry as the Word document the user keeps (#190, ADR-0024).
 *
 * Fetched and handed to the browser as a blob rather than pointed at with a plain link:
 * a link that came back 403 or 404 would replace the profile page with an error body,
 * and this way a failure stays a message beside the entry that failed.
 *
 * The document itself is built on the backend from the stored snapshot, not from the
 * entry this page happens to be holding, so the file reproduces exactly what the store
 * holds.
 */
export async function exportSearchHistoryEntry(id: number): Promise<void> {
  const response = await fetch(`${SEARCH_HISTORY_URL}${id}/export/`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new SearchHistoryExportError(`entry ${id} not exported: ${response.status}`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filenameFrom(response.headers.get("Content-Disposition"));
  link.click();
  // Released on the next tick, not straight after the click: the download reads the blob
  // out of the object URL, and revoking it in the same turn can beat it to it.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
