import { useEffect, useRef, useState } from "react";
import {
  clearSearchHistory,
  deleteSearchHistoryEntry,
  exportSearchHistoryEntry,
  fetchSearchHistory,
  type StoredSearchHistoryEntry,
  type SearchHistoryVersion,
} from "../../api/searchHistory";
import { matchPercentage } from "../../history/matchPercentage";
import { FormError } from "./AccountShell";

/** The quiet control every per-entry action wears: a history entry is the user's to keep
 *  or throw away, but nothing on this page should shout about either. */
const ROW_BUTTON =
  "cursor-pointer rounded px-2 py-1 text-xs text-[#6B6B67] hover:bg-[#F0EEE6] hover:text-[#3F3F3C]";

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
  onExport,
  onDelete,
}: {
  entry: StoredSearchHistoryEntry;
  onExport: () => void;
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
        {/* Export sits before Delete: the log rolls at 50, so keeping a search is the
            act that has to be reachable, and the destructive one is the last thing the
            hand lands on. */}
        <button
          type="button"
          onClick={onExport}
          // Named after the search for the same reason Delete is: "Export" repeated down
          // a list of 50 names nothing to a screen reader.
          aria-label={`Export search “${entry.query}” as a Word document`}
          className={`mt-3 shrink-0 ${ROW_BUTTON}`}
        >
          Export
        </button>
        <button
          type="button"
          onClick={onDelete}
          // The query is in the accessible name because "Delete" repeated 50 times down a
          // list names nothing: a screen reader hears which search it removes.
          aria-label={`Delete search “${entry.query}”`}
          className={`mt-3 shrink-0 ${ROW_BUTTON}`}
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
 * removed from it entry by entry or all at once (#189), and exported one entry at a time
 * as a Word document (#190).
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
  // One slot for whichever act last failed: only one runs at a time, and two
  // messages stacked above a list would leave the user guessing which is current.
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchSearchHistory().then(setEntries, () => setFailed(true));
  }, []);

  // Two clicks before the first DELETE lands would send the request twice, and the
  // second one 404s on a row that is already gone — the user would be told the delete
  // failed when it had in fact succeeded. A ref, not state: both clicks in one tick read
  // the same value, and a re-render has not delivered the new one to either of them.
  const removing = useRef(false);

  /** The shape both removals share: ask, call, and let the screen follow the server.
   *
   * `window.confirm` is what this codebase already asks a destructive question with —
   * closing a Document, resetting the parameters. A history entry is not more dangerous
   * than either, and one confirm the whole app over is one the visitor already knows.
   */
  async function confirmAndRemove(
    question: string,
    remove: () => Promise<void>,
    survivors: (current: StoredSearchHistoryEntry[]) => StoredSearchHistoryEntry[],
    failure: string,
  ) {
    if (removing.current || !window.confirm(question)) return;
    removing.current = true;
    setActionError(null);
    try {
      await remove();
      setEntries((current) => survivors(current ?? []));
    } catch {
      setActionError(failure);
    } finally {
      removing.current = false;
    }
  }

  function removeEntry(entry: StoredSearchHistoryEntry) {
    return confirmAndRemove(
      `Delete the search “${entry.query}” from your history?`,
      () => deleteSearchHistoryEntry(entry.id),
      (current) => current.filter((candidate) => candidate.id !== entry.id),
      "Could not delete that search. Please try again.",
    );
  }

  function removeEverything() {
    return confirmAndRemove(
      "Clear your entire search history? This cannot be undone.",
      clearSearchHistory,
      // Empty, not re-read: the endpoint clears the acting user's entries, so what is
      // left is nothing, and a round trip would only invite a fresh failure to explain.
      () => [],
      "Could not clear your search history. Please try again.",
    );
  }

  // A second click while the file is still being built would fetch and save the same
  // document twice. Separate from `removing` because the two acts do not exclude each
  // other: exporting an entry is a fine thing to do while a delete is in flight.
  const exporting = useRef(false);

  async function exportEntry(entry: StoredSearchHistoryEntry) {
    // No confirm, unlike either removal: an export takes nothing away, so there is
    // nothing to agree to.
    if (exporting.current) return;
    exporting.current = true;
    setActionError(null);
    try {
      await exportSearchHistoryEntry(entry.id);
    } catch {
      setActionError("Could not export that search. Please try again.");
    } finally {
      exporting.current = false;
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
            onClick={() => void removeEverything()}
            className={ROW_BUTTON}
          >
            Clear all
          </button>
        )}
      </div>
      {actionError && (
        <div className="mt-2">
          <FormError message={actionError} />
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
              onExport={() => void exportEntry(entry)}
              onDelete={() => void removeEntry(entry)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
