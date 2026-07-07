import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore, MAX_OPEN_DOCUMENTS } from "./documentStore";
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
    parsed_json: { type: "text", segments: [] },
    created_at: "2026-01-01",
    meta: { title, author: "", language: "ga", pbCount: 0 },
    anchors: [],
    word_array: [],
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
