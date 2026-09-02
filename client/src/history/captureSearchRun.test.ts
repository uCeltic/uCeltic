import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureSearchRun } from "./captureSearchRun";
import { saveSearchHistoryEntry } from "../api/searchHistory";
import { useAuthStore } from "../store/authStore";
import { useDocumentStore } from "../store/documentStore";
import type { SearchRun } from "../store/searchStore";
import type { Document } from "../types/document";
import type { SearchResult } from "../types/search";

vi.mock("../api/searchHistory", () => ({ saveSearchHistoryEntry: vi.fn() }));
const mockedSave = vi.mocked(saveSearchHistoryEntry);

function hit(snippet: string, score: number): SearchResult {
  return {
    score,
    snippet,
    word_start: 0,
    word_end: 3,
    anchor_id: null,
    anchor_tag: null,
    line_no: null,
  };
}

function teiDocument(id: string, title: string, serverId: number): Document {
  return {
    id,
    title,
    format: "tei",
    // Only `content.id` is read here; the rest of a TEIDoc is irrelevant to the snapshot.
    content: { id: serverId, title } as unknown as Extract<
      Document,
      { format: "tei" }
    >["content"],
  };
}

const LU = teiDocument("doc-tei-1", "Lebor na hUidre", 1);
const YBL = teiDocument("doc-tei-2", "The Yellow Book of Lecan", 2);

function run(overrides: Partial<SearchRun> = {}): SearchRun {
  return {
    query: "ro gab in ri",
    origin: "typed",
    excludedDocId: null,
    params: {
      matchLength: 130,
      precision: 1,
      dissimilarityScore: 0.5,
      topK: 10,
    },
    columns: [
      { docId: 1, clientDocId: "doc-tei-1", outcome: "results" },
      { docId: 2, clientDocId: "doc-tei-2", outcome: "zero-hits" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockedSave.mockReset();
  useAuthStore.setState({
    status: "authenticated",
    user: { email: "reader@example.com" } as never,
  });
  useDocumentStore.setState({
    openDocuments: [LU, YBL],
    visibleDocumentIds: [LU.id, YBL.id],
  });
});

describe("captureSearchRun", () => {
  it("saves the whole search: query, params, origin, and each returning column", () => {
    captureSearchRun(run(), {
      "doc-tei-1": [hit("ro gab in ri cetus", 0.12), hit("gabais in ri", 0.41)],
      "doc-tei-2": [],
    });

    expect(mockedSave).toHaveBeenCalledWith({
      query: "ro gab in ri",
      query_origin: "typed",
      window_size_ratio: 1.3,
      step_size: 1,
      dissimilarity_threshold: 0.5,
      top_k: 10,
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
    });
  });

  it("records a selection search's origin", () => {
    captureSearchRun(run({ origin: "selection", excludedDocId: "doc-tei-2" }), {
      "doc-tei-1": [hit("ro gab", 0.1)],
      "doc-tei-2": [],
    });

    expect(mockedSave.mock.calls[0][0].query_origin).toBe("selection");
  });

  it("leaves an errored column out of the snapshot and keeps a zero-hit one", () => {
    captureSearchRun(
      run({
        columns: [
          { docId: 1, clientDocId: "doc-tei-1", outcome: "errored" },
          { docId: 2, clientDocId: "doc-tei-2", outcome: "zero-hits" },
        ],
      }),
      { "doc-tei-2": [] },
    );

    expect(mockedSave.mock.calls[0][0].versions).toEqual([
      { title: "The Yellow Book of Lecan", hits: [] },
    ]);
  });

  it("stores nothing when every column errored", () => {
    captureSearchRun(
      run({
        columns: [
          { docId: 1, clientDocId: "doc-tei-1", outcome: "errored" },
          { docId: 2, clientDocId: "doc-tei-2", outcome: "errored" },
        ],
      }),
      {},
    );

    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("stores nothing when no column was searched at all", () => {
    captureSearchRun(run({ columns: [] }), {});

    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("stores nothing for an anonymous visitor", () => {
    useAuthStore.setState({ status: "anonymous", user: null });

    captureSearchRun(run(), { "doc-tei-1": [hit("ro gab", 0.1)], "doc-tei-2": [] });

    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("stores nothing before the session probe has answered", () => {
    useAuthStore.setState({ status: "unknown", user: null });

    captureSearchRun(run(), { "doc-tei-1": [hit("ro gab", 0.1)], "doc-tei-2": [] });

    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("leaves out a column whose document is no longer open", () => {
    // Closing a column already drops it from the run (#186), so this is the
    // belt-and-braces case: with no document there is no Version title to freeze, and a
    // snapshot cannot name a Version it cannot name.
    useDocumentStore.setState({ openDocuments: [YBL], visibleDocumentIds: [YBL.id] });

    captureSearchRun(run(), {
      "doc-tei-1": [hit("ro gab", 0.1)],
      "doc-tei-2": [],
    });

    expect(mockedSave.mock.calls[0][0].versions).toEqual([
      { title: "The Yellow Book of Lecan", hits: [] },
    ]);
  });
});
