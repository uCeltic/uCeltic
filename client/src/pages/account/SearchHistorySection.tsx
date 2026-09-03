import { useEffect, useState } from "react";
import {
  clearSearchHistory,
  deleteSearchHistoryEntry,
  fetchSearchHistory,
  type StoredSearchHistoryEntry,
  type SearchHistoryVersion,
} from "../../api/searchHistory";
import { matchPercentage } from "../../history/matchPercentage";
import { FormError } from "./AccountShell";

/** How the moment a search was made is put in front of a reader. The machine-readable
 *  form stays on the `<time>` element's `dateTime`, so the display can be as loose as it
 *  likes without losing the exact instant. */
function whenSearched(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** One column of the search, as it came back then: the Version's title frozen as text,
 *  and its hits ranked as the search returned them. */
function VersionHits({ version }: { version: SearchHistoryVersion }) {
  return (
    <div className="mt-3 first:mt-0">
      <h4 className="text-xs font-semibold text-[#52524F]">{version.title}</h4>
      {version.hits.length === 0 ? (
        // Kept deliberately: a column that found nothing is part of what this search was
        // (ADR-0024). A column that *errored* never reached the snapshot at all.
        <p className="mt-1 text-xs text-[#8A8A85]">No matches.</p>
      ) : (
        <ol className="mt-1 space-y-1">
          {version.hits.map((hit, index) => (
            <li
              key={index}
              className="flex items-baseline justify-between gap-3 rounded border border-[#E8E4D8] bg-[#FAF9F5] px-2 py-1"
            >
              <span className="text-xs text-[#52524F]">{hit.snippet}</span>
              {/* Never the stored score: that is a dissimilarity, and shown raw it reads
                  backwards. `(1 − score) × 100 %` — higher is closer. */}
              <span className="shrink-0 text-xs tabular-nums text-[#6B6B67]">
                {matchPercentage(hit.score)} match
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** One entry: closed, it is what the user searched, when, and where; opened, it is what
 *  came back. Closed by default because the log holds up to 50 of these. */
function HistoryEntry({
  entry,
  onDelete,
}: {
  entry: StoredSearchHistoryEntry;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-[#E8E4D8] last:border-b-0">
      {/* The two controls are siblings, not nested: Delete must not be a button inside
          the row's own toggle button, and clicking one must never mean the other. */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-expanded={open}
          className="flex-1 cursor-pointer px-1 py-3 text-left hover:bg-[#FAF9F5]"
        >
          <span className="block text-sm font-medium text-[#3F3F3C]">{entry.query}</span>
          <span className="mt-0.5 block text-xs text-[#6B6B67]">
            <time dateTime={entry.created_at}>{whenSearched(entry.created_at)}</time>
            {" · "}
            {entry.versions.map((version) => version.title).join(", ")}
          </span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          // The query is in the accessible name because "Delete" repeated 50 times down a
          // list names nothing: a screen reader hears which search it removes.
          aria-label={`Delete search “${entry.query}”`}
          className="mt-3 shrink-0 cursor-pointer rounded px-2 py-1 text-xs text-[#6B6B67] hover:bg-[#F0EEE6] hover:text-[#3F3F3C]"
        >
          Delete
        </button>
      </div>
      {open && (
        <div className="px-1 pb-3">
          {entry.versions.map((version, index) => (
            <VersionHits key={index} version={version} />
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The signed-in user's own Search History, read back on their profile (#188, ADR-0024),
 * and removed from it entry by entry or all at once (#189).
 *
 * Every entry here is an immutable snapshot, never a re-runnable query: what it shows is
 * what that search returned at the time, and nothing in it points at a TEI Document, so
 * a Version later renamed or deleted leaves the entry whole.
 *
 * The list is rendered in the order the store returns it — newest first — rather than
 * re-sorted here: `-created_at, -pk` is the same order the 50-entry cap rolls on, and two
 * places deciding "newest" is two places to disagree.
 *
 * Removal is deliberately *not* optimistic. The log rolls at 50 and export is the only
 * durable copy, so an entry that is still in the store must never look gone: the screen
 * changes only once the server says the row is gone, and a failure says so.
 */
export default function SearchHistorySection() {
  const [entries, setEntries] = useState<StoredSearchHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [removalError, setRemovalError] = useState<string | null>(null);

  useEffect(() => {
    fetchSearchHistory().then(setEntries, () => setFailed(true));
  }, []);

  // `window.confirm` is what this codebase already asks a destructive question with —
  // closing a Document, resetting the parameters. A history entry is not more dangerous
  // than either, and one confirm the whole app over is one the visitor already knows.
  async function removeEntry(entry: StoredSearchHistoryEntry) {
    if (!window.confirm(`Delete the search “${entry.query}” from your history?`)) return;
    setRemovalError(null);
    try {
      await deleteSearchHistoryEntry(entry.id);
      setEntries((current) =>
        (current ?? []).filter((candidate) => candidate.id !== entry.id),
      );
    } catch {
      setRemovalError("Could not delete that search. Please try again.");
    }
  }

  async function removeEverything() {
    if (!window.confirm("Clear your entire search history? This cannot be undone."))
      return;
    setRemovalError(null);
    try {
      await clearSearchHistory();
      // Empty, not re-read: the endpoint clears the acting user's entries, so what is
      // left is nothing, and a round trip would only invite a fresh failure to explain.
      setEntries([]);
    } catch {
      setRemovalError("Could not clear your search history. Please try again.");
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#52524F]">Search history</h2>
        {/* Only offered when there is something to clear: a button that would remove
            nothing is a question with one answer. */}
        {entries !== null && entries.length > 0 && (
          <button
            type="button"
            onClick={removeEverything}
            className="cursor-pointer rounded px-2 py-1 text-xs text-[#6B6B67] hover:bg-[#F0EEE6] hover:text-[#3F3F3C]"
          >
            Clear all
          </button>
        )}
      </div>
      {removalError && (
        <div className="mt-2">
          <FormError message={removalError} />
        </div>
      )}
      {failed ? (
        // Unlike a failed capture, this one is the visitor's business: they opened the
        // page to look at it, and an empty list would be a lie. Said through the shell's
        // own `FormError` so every /account failure reads the same, forms included.
        <div className="mt-2">
          <FormError message="Could not load your search history. Please try again." />
        </div>
      ) : entries === null ? null : entries.length === 0 ? (
        <p className="mt-2 text-sm text-[#6B6B67]">
          Searches you run while signed in will appear here — your most recent 50.
        </p>
      ) : (
        <ul className="mt-2">
          {entries.map((entry) => (
            <HistoryEntry
              key={entry.id}
              entry={entry}
              onDelete={() => void removeEntry(entry)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
