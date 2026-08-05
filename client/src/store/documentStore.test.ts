import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDocumentStore,
  MAX_OPEN_DOCUMENTS,
  getSearchableDocuments,
  planTEIOpen,
} from "./documentStore";
import { logEvent } from "../api/log";
import type { TEIDoc } from "../types/tei";

// behavior logging is a side effect, not the point of these store tests —
// mock it so we can assert the emitted events without a real network call.
vi.mock("../api/log", () => ({ logEvent: vi.fn() }));
const mockedLogEvent = vi.mocked(logEvent);

// Minimal TEIDoc factory — only id/title matter for these tests.
function makeTEIDoc(id: number, title = `Doc ${id}`): TEIDoc {
  return {
    id,
    title,
    language: "ga",
    work: null,
    parsed_json: { type: "text", segments: [] },
    created_at: "2026-01-01",
    meta: { title, author: "", language: "ga", pbCount: 0 },
    anchors: [],
    word_array: [],
    name_index: null,
  };
}

beforeEach(() => {
  mockedLogEvent.mockReset();
  useDocumentStore.setState({
    openDocuments: [],
    visibleDocumentIds: [],
    activeDocumentId: null,
  });
});

describe("documentStore.addDocument", () => {
  //Test: opens a text document, doc exists, content is correct, visible and active
  it("opens a text document, shows it, and makes it active", () => {
    useDocumentStore.getState().addDocument("Notes", "hello world");

    const s = useDocumentStore.getState();
    expect(s.openDocuments).toHaveLength(1);
    expect(s.openDocuments[0]).toMatchObject({
      title: "Notes",
      format: "txt",
      content: "hello world",
    });
    expect(s.activeDocumentId).toBe(s.openDocuments[0].id);
    expect(s.visibleDocumentIds).toContain(s.openDocuments[0].id);
  });

  //Test: refuses to open more than MAX_OPEN_DOCUMENTS
  it("refuses to open more than MAX_OPEN_DOCUMENTS", () => {
    for (let i = 0; i < MAX_OPEN_DOCUMENTS; i++) {
      useDocumentStore.getState().addDocument(`doc ${i}`, "x");
    }
    expect(useDocumentStore.getState().openDocuments).toHaveLength(
      MAX_OPEN_DOCUMENTS,
    );

    useDocumentStore.getState().addDocument("overflow", "x");
    expect(useDocumentStore.getState().openDocuments).toHaveLength(
      MAX_OPEN_DOCUMENTS,
    );
  });

  //Test: opening a text document logs one document_opened event with doc_id and title
  it("logs document_opened with the new doc's id and title", () => {
    useDocumentStore.getState().addDocument("Notes", "hello world");

    const id = useDocumentStore.getState().openDocuments[0].id;
    expect(mockedLogEvent).toHaveBeenCalledOnce();
    expect(mockedLogEvent).toHaveBeenCalledWith("document_opened", {
      doc_id: id,
      title: "Notes",
    });
  });

  //Test: hitting the MAX_OPEN_DOCUMENTS cap logs nothing for the rejected document
  it("does not log document_opened when the cap rejects the document", () => {
    for (let i = 0; i < MAX_OPEN_DOCUMENTS; i++) {
      useDocumentStore.getState().addDocument(`doc ${i}`, "x");
    }
    mockedLogEvent.mockClear();

    useDocumentStore.getState().addDocument("overflow", "x");
    expect(mockedLogEvent).not.toHaveBeenCalled();
  });
});

describe("documentStore.removeDocument", () => {
  //Test: removes the document, and remove from both the open and visible lists
  it("removes the document from both the open and visible lists", () => {
    useDocumentStore.getState().addDocument("Notes", "hello");
    const id = useDocumentStore.getState().openDocuments[0].id;

    useDocumentStore.getState().removeDocument(id);

    const s = useDocumentStore.getState();
    expect(s.openDocuments).toHaveLength(0);
    expect(s.visibleDocumentIds).not.toContain(id);
  });

  //Test: closing a document logs one document_closed event with its id and title
  it("logs document_closed with the removed doc's id and title", () => {
    useDocumentStore.getState().addDocument("Notes", "hello");
    const id = useDocumentStore.getState().openDocuments[0].id;
    mockedLogEvent.mockClear();

    useDocumentStore.getState().removeDocument(id);

    expect(mockedLogEvent).toHaveBeenCalledOnce();
    expect(mockedLogEvent).toHaveBeenCalledWith("document_closed", {
      doc_id: id,
      title: "Notes",
    });
  });

  //Test: removing an id that isn't open logs nothing
  it("does not log document_closed for an id that isn't open", () => {
    useDocumentStore.getState().removeDocument("doc-does-not-exist");
    expect(mockedLogEvent).not.toHaveBeenCalled();
  });
});

describe("documentStore.addTEIDocument open-once", () => {
  it("opens the same TEI document at most once", () => {
    const doc = makeTEIDoc(1);
    useDocumentStore.getState().addTEIDocument(doc);
    useDocumentStore.getState().addTEIDocument(doc);

    expect(useDocumentStore.getState().openDocuments).toHaveLength(1);
  });

  it("re-focuses the existing column when re-opening", () => {
    const a = makeTEIDoc(1);
    const b = makeTEIDoc(2);
    useDocumentStore.getState().addTEIDocument(a);
    useDocumentStore.getState().addTEIDocument(b); // active 现在是 b
    useDocumentStore.getState().addTEIDocument(a); // 重新打开 a

    expect(useDocumentStore.getState().activeDocumentId).toBe("doc-tei-1");
  });

  it("restores visibility when re-opening a document that is not visible", () => {
    const a = makeTEIDoc(1);
    useDocumentStore.getState().addTEIDocument(a);
    useDocumentStore.setState({ visibleDocumentIds: [] }); // simulate it is removed from visible
    useDocumentStore.getState().addTEIDocument(a);

    const s = useDocumentStore.getState();
    expect(s.visibleDocumentIds).toContain("doc-tei-1");
    expect(s.visibleDocumentIds).toHaveLength(1); // not duplicate
  });

  //Test: opening a TEI document logs one document_opened event with doc_id and title
  it("logs document_opened when opening a TEI document", () => {
    const doc = makeTEIDoc(1, "Táin Bó Cúailnge");
    useDocumentStore.getState().addTEIDocument(doc);

    expect(mockedLogEvent).toHaveBeenCalledOnce();
    expect(mockedLogEvent).toHaveBeenCalledWith("document_opened", {
      doc_id: "doc-tei-1",
      title: "Táin Bó Cúailnge",
    });
  });

  //Test: re-opening an already-open TEI document is a re-focus, not a new open — logs nothing
  it("does not log document_opened when re-focusing an already-open TEI document", () => {
    const doc = makeTEIDoc(1);
    useDocumentStore.getState().addTEIDocument(doc);
    mockedLogEvent.mockClear();

    useDocumentStore.getState().addTEIDocument(doc);

    expect(mockedLogEvent).not.toHaveBeenCalled();
  });
});

describe("getSearchableDocuments", () => {
  //Test: only the TEI documents that are currently visible can be searched
  it("returns the visible TEI documents, in visible order", () => {
    useDocumentStore.getState().addTEIDocument(makeTEIDoc(1, "First"));
    useDocumentStore.getState().addTEIDocument(makeTEIDoc(2, "Second"));

    const searchable = getSearchableDocuments(useDocumentStore.getState());

    expect(searchable.map((d) => d.id)).toEqual(["doc-tei-1", "doc-tei-2"]);
    expect(searchable.map((d) => d.content.id)).toEqual([1, 2]);
  });

  //Test: a selection-triggered search never searches the document it came from
  it("leaves out the excluded document", () => {
    useDocumentStore.getState().addTEIDocument(makeTEIDoc(1, "First"));
    useDocumentStore.getState().addTEIDocument(makeTEIDoc(2, "Second"));

    const searchable = getSearchableDocuments(useDocumentStore.getState(), {
      excludedDocId: "doc-tei-1",
    });

    expect(searchable.map((d) => d.id)).toEqual(["doc-tei-2"]);
  });

  //Test: the source document may be the only visible TEI one — then nothing is searchable
  it("returns nothing when the excluded document is the only visible TEI one", () => {
    useDocumentStore.getState().addTEIDocument(makeTEIDoc(1, "First"));

    const searchable = getSearchableDocuments(useDocumentStore.getState(), {
      excludedDocId: "doc-tei-1",
    });

    expect(searchable).toEqual([]);
  });
});

// Occupy n columns with text documents. Set directly rather than through
// addDocument, whose `doc-${Date.now()}` ids collide within one millisecond.
function fillWith(n: number) {
  useDocumentStore.setState({
    openDocuments: Array.from({ length: n }, (_, i) => ({
      id: `doc-filler-${i}`,
      title: `doc ${i}`,
      format: "txt" as const,
      content: "x",
    })),
  });
}

describe("planTEIOpen", () => {
  // Opening a whole work is one action over several documents, so the limit has
  // to be answered before the first fetch — not discovered document by document
  // as the store silently drops the ones that no longer fit (#152).
  it("takes every requested document when there is room", () => {
    const plan = planTEIOpen(useDocumentStore.getState(), [1, 2, 3]);

    expect(plan.toOpen).toEqual([1, 2, 3]);
    expect(plan.skipped).toEqual([]);
  });

  it("fills the remaining slots in request order and reports the rest", () => {
    fillWith(MAX_OPEN_DOCUMENTS - 2);

    const plan = planTEIOpen(useDocumentStore.getState(), [1, 2, 3, 4]);

    expect(plan.toOpen).toEqual([1, 2]);
    expect(plan.skipped).toEqual([3, 4]);
  });

  // An already-open document is re-focused rather than opened again, so it
  // costs no slot — counting it as one would refuse an open that fits — and it
  // is reported apart from the documents that really were opened.
  it("does not spend a slot on a document that is already open", () => {
    fillWith(MAX_OPEN_DOCUMENTS - 2);
    useDocumentStore.getState().addTEIDocument(makeTEIDoc(1));
    // one free slot left, and doc 1 is open

    const plan = planTEIOpen(useDocumentStore.getState(), [1, 2, 3]);

    expect(plan.alreadyOpen).toEqual([1]);
    expect(plan.toOpen).toEqual([2]);
    expect(plan.skipped).toEqual([3]);
  });

  it("counts a repeated request once", () => {
    const plan = planTEIOpen(useDocumentStore.getState(), [1, 1, 2]);
    expect(plan.toOpen).toEqual([1, 2]);
  });

  it("skips everything when the workspace is full", () => {
    fillWith(MAX_OPEN_DOCUMENTS);

    const plan = planTEIOpen(useDocumentStore.getState(), [1, 2]);

    expect(plan.toOpen).toEqual([]);
    expect(plan.skipped).toEqual([1, 2]);
  });
});
