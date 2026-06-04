import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore, MAX_OPEN_DOCUMENTS } from "./documentStore";

beforeEach(() => {
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
    expect(useDocumentStore.getState().openDocuments).toHaveLength(MAX_OPEN_DOCUMENTS);

    useDocumentStore.getState().addDocument("overflow", "x");
    expect(useDocumentStore.getState().openDocuments).toHaveLength(MAX_OPEN_DOCUMENTS);
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
});