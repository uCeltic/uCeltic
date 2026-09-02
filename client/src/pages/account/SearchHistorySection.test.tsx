import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SearchHistorySection from "./SearchHistorySection";
import * as searchHistoryApi from "../../api/searchHistory";
import { SearchHistoryError, type StoredSearchHistoryEntry } from "../../api/searchHistory";

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

    const rows = await screen.findAllByRole("button", { name: /newest|middle|oldest/ });
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

    const row = await screen.findByRole("button", { name: /ro gab in ri/ });
    expect(row).toHaveTextContent("Lebor na hUidre");
    expect(row).toHaveTextContent("The Yellow Book of Lecan");
  });

  it("shows each hit as a match percentage, never the stored dissimilarity", async () => {
    renderHistory([anEntry()]);

    fireEvent.click(await screen.findByRole("button", { name: /ro gab in ri/ }));

    expect(screen.getByText("ro gab in ri cetus")).toBeInTheDocument();
    // (1 − 0.12) × 100 and (1 − 0.41) × 100 — higher reads as closer.
    expect(screen.getByText("88% match")).toBeInTheDocument();
    expect(screen.getByText("59% match")).toBeInTheDocument();
    expect(screen.queryByText(/0\.12/)).not.toBeInTheDocument();
  });

  it("keeps a column that found nothing: a search that found nothing is still a search", async () => {
    renderHistory([anEntry()]);

    fireEvent.click(await screen.findByRole("button", { name: /ro gab in ri/ }));

    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it("hides the hits again when the entry is closed", async () => {
    renderHistory([anEntry()]);

    const row = await screen.findByRole("button", { name: /ro gab in ri/ });
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
      new SearchHistoryError("search history not read: 500"),
    );

    render(<SearchHistorySection />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });
});
