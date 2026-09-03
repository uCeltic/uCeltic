import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SearchHistorySection from "./SearchHistorySection";
import * as searchHistoryApi from "../../api/searchHistory";
import {
  SearchHistoryDeleteError,
  SearchHistoryReadError,
  type StoredSearchHistoryEntry,
} from "../../api/searchHistory";

afterEach(() => vi.restoreAllMocks());

function anEntry(overrides: Partial<StoredSearchHistoryEntry> = {}): StoredSearchHistoryEntry {
  return {
    id: 1,
    query: "ro gab in ri",
    query_origin: "typed",
    window_size_ratio: 1.3,
    step_size: 1,
    dissimilarity_threshold: 0.5,
    top_k: 10,
    created_at: "2026-09-01T10:00:00Z",
    versions: [
      {
        title: "Lebor na hUidre",
        hits: [
          { snippet: "ro gab in ri cetus", score: 0.12 },
          { snippet: "gabais in ri", score: 0.41 },
        ],
      },
      { title: "The Yellow Book of Lecan", hits: [] },
    ],
    ...overrides,
  };
}

/** The row's own open/close control, told apart from the Delete button beside it — both
 *  are named after the same search, and only the toggle carries `aria-expanded`. */
async function entryToggle(query: RegExp) {
  const named = await screen.findAllByRole("button", { name: query });
  return named.find((button) => button.hasAttribute("aria-expanded"))!;
}

function renderHistory(entries: StoredSearchHistoryEntry[]) {
  vi.spyOn(searchHistoryApi, "fetchSearchHistory").mockResolvedValue(entries);
  return render(<SearchHistorySection />);
}

describe("SearchHistorySection", () => {
  it("lists the searches in the order the store returned them — newest first", async () => {
    renderHistory([
      anEntry({ id: 3, query: "newest" }),
      anEntry({ id: 2, query: "middle" }),
      anEntry({ id: 1, query: "oldest" }),
    ]);

    const rows = await Promise.all([entryToggle(/newest/), entryToggle(/middle/), entryToggle(/oldest/)]);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("newest"),
      expect.stringContaining("middle"),
      expect.stringContaining("oldest"),
    ]);
  });

  it("shows when a search was made, machine-readable as well as read", async () => {
    renderHistory([anEntry()]);

    const when = await screen.findByText((_, element) => element?.tagName === "TIME");
    expect(when).toHaveAttribute("dateTime", "2026-09-01T10:00:00Z");
    expect(when.textContent).not.toBe("");
  });

  it("names the Versions the search covered, without opening the entry", async () => {
    renderHistory([anEntry()]);

    const row = await entryToggle(/ro gab in ri/);
    expect(row).toHaveTextContent("Lebor na hUidre");
    expect(row).toHaveTextContent("The Yellow Book of Lecan");
  });

  it("shows each hit as a match percentage, never the stored dissimilarity", async () => {
    renderHistory([anEntry()]);

    fireEvent.click(await entryToggle(/ro gab in ri/));

    expect(screen.getByText("ro gab in ri cetus")).toBeInTheDocument();
    // (1 − 0.12) × 100 and (1 − 0.41) × 100 — higher reads as closer.
    expect(screen.getByText("88% match")).toBeInTheDocument();
    expect(screen.getByText("59% match")).toBeInTheDocument();
    expect(screen.queryByText(/0\.12/)).not.toBeInTheDocument();
  });

  it("keeps a column that found nothing: a search that found nothing is still a search", async () => {
    renderHistory([anEntry()]);

    fireEvent.click(await entryToggle(/ro gab in ri/));

    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it("hides the hits again when the entry is closed", async () => {
    renderHistory([anEntry()]);

    const row = await entryToggle(/ro gab in ri/);
    fireEvent.click(row);
    fireEvent.click(row);

    expect(screen.queryByText("ro gab in ri cetus")).not.toBeInTheDocument();
  });

  it("says so when there is no history yet, rather than showing an empty box", async () => {
    renderHistory([]);

    expect(await screen.findByText(/searches you run.*will appear here/i)).toBeInTheDocument();
  });

  it("tells the visitor when the history could not be read — they came here to see it", async () => {
    vi.spyOn(searchHistoryApi, "fetchSearchHistory").mockRejectedValue(
      new SearchHistoryReadError("search history not read: 500"),
    );

    render(<SearchHistorySection />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });
});

describe("removing entries", () => {
  it("deletes the one entry the user asked for, once they confirm", async () => {
    const deleteEntry = vi
      .spyOn(searchHistoryApi, "deleteSearchHistoryEntry")
      .mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHistory([anEntry({ id: 3, query: "keep me" }), anEntry({ id: 7, query: "drop me" })]);

    fireEvent.click(await screen.findByRole("button", { name: /delete .*drop me/i }));

    await waitFor(() => expect(screen.queryByText("drop me")).not.toBeInTheDocument());
    expect(deleteEntry).toHaveBeenCalledWith(7);
    expect(screen.getByText("keep me")).toBeInTheDocument();
  });

  it("leaves the entry alone when the confirm is cancelled", async () => {
    const deleteEntry = vi
      .spyOn(searchHistoryApi, "deleteSearchHistoryEntry")
      .mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHistory([anEntry({ id: 7, query: "drop me" })]);

    fireEvent.click(await screen.findByRole("button", { name: /delete .*drop me/i }));

    expect(deleteEntry).not.toHaveBeenCalled();
    expect(screen.getByText("drop me")).toBeInTheDocument();
  });

  it("keeps the entry on screen when the delete failed — it is still there", async () => {
    vi.spyOn(searchHistoryApi, "deleteSearchHistoryEntry").mockRejectedValue(
      new SearchHistoryDeleteError("entry 7 not deleted: 500"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHistory([anEntry({ id: 7, query: "drop me" })]);

    fireEvent.click(await screen.findByRole("button", { name: /delete .*drop me/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not delete/i);
    expect(screen.getByText("drop me")).toBeInTheDocument();
  });

  it("clears the whole history once the user confirms", async () => {
    const clear = vi.spyOn(searchHistoryApi, "clearSearchHistory").mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHistory([anEntry({ id: 1, query: "one" }), anEntry({ id: 2, query: "two" })]);

    fireEvent.click(await screen.findByRole("button", { name: /clear all/i }));

    expect(await screen.findByText(/searches you run.*will appear here/i)).toBeInTheDocument();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("leaves the whole history alone when the clear confirm is cancelled", async () => {
    const clear = vi.spyOn(searchHistoryApi, "clearSearchHistory").mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHistory([anEntry({ id: 1, query: "one" })]);

    fireEvent.click(await screen.findByRole("button", { name: /clear all/i }));

    expect(clear).not.toHaveBeenCalled();
    expect(screen.getByText("one")).toBeInTheDocument();
  });

  it("keeps the history on screen when the clear failed", async () => {
    vi.spyOn(searchHistoryApi, "clearSearchHistory").mockRejectedValue(
      new SearchHistoryDeleteError("search history not cleared: 500"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHistory([anEntry({ id: 1, query: "one" })]);

    fireEvent.click(await screen.findByRole("button", { name: /clear all/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not clear/i);
    expect(screen.getByText("one")).toBeInTheDocument();
  });

  it("offers nothing to clear when there is no history", async () => {
    renderHistory([]);

    await screen.findByText(/searches you run.*will appear here/i);
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("names the search in each confirm, so the user knows what they are agreeing to", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHistory([anEntry({ id: 7, query: "drop me" })]);

    fireEvent.click(await screen.findByRole("button", { name: /delete .*drop me/i }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("drop me"));

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringMatching(/all|whole|entire/i));
  });
});
