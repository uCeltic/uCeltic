import { useEffect, useState } from "react";
import {
  fetchSearchHistory,
  type StoredSearchHistoryEntry,
  type SearchHistoryVersion,
} from "../../api/searchHistory";
import { matchPercentage } from "../../history/matchPercentage";

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
function HistoryEntry({ entry }: { entry: StoredSearchHistoryEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-[#E8E4D8] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className="w-full cursor-pointer px-1 py-3 text-left hover:bg-[#FAF9F5]"
      >
        <span className="block text-sm font-medium text-[#3F3F3C]">{entry.query}</span>
        <span className="mt-0.5 block text-xs text-[#6B6B67]">
          <time dateTime={entry.created_at}>{whenSearched(entry.created_at)}</time>
          {" · "}
          {entry.versions.map((version) => version.title).join(", ")}
        </span>
      </button>
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
 * The signed-in user's own Search History, read back on their profile (#188, ADR-0024).
 *
 * Every entry here is an immutable snapshot, never a re-runnable query: what it shows is
 * what that search returned at the time, and nothing in it points at a TEI Document, so
 * a Version later renamed or deleted leaves the entry whole.
 *
 * The list is rendered in the order the store returns it — newest first — rather than
 * re-sorted here: `-created_at, -pk` is the same order the 50-entry cap rolls on, and two
 * places deciding "newest" is two places to disagree.
 */
export default function SearchHistorySection() {
  const [entries, setEntries] = useState<StoredSearchHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchSearchHistory().then(setEntries, () => setFailed(true));
  }, []);

  return (
    <section>
      <h2 className="text-sm font-semibold text-[#52524F]">Search history</h2>
      {failed ? (
        // Unlike a failed capture, this one is the visitor's business: they opened the
        // page to look at it, and an empty list would be a lie.
        <p
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          Could not load your search history. Please try again.
        </p>
      ) : entries === null ? null : entries.length === 0 ? (
        <p className="mt-2 text-sm text-[#6B6B67]">
          Searches you run while signed in will appear here — your most recent 50.
        </p>
      ) : (
        <ul className="mt-2">
          {entries.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
