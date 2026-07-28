import { create } from "zustand";
import type { Document, DocumentId } from "../types/document";
import type { TEIDoc } from "../types/tei";
import { logEvent } from "../api/log";

// shared {doc_id, title} payload shape for open/close events
function logDocEvent(
  eventType: "document_opened" | "document_closed",
  id: DocumentId,
  title: string,
): void {
  logEvent(eventType, { doc_id: id, title });
}

export const MAX_OPEN_DOCUMENTS = 8;
export const MAX_VISIBLE_DOCUMENTS = 8;

// This Zustand store is the shared "document workspace" state.
// Components use it to answer questions like:
// - Which documents are currently open?
// - Which open documents are visible in the viewer area?
// - Which document tab/panel is currently active?
// - How do we add, remove, or focus a document?
interface DocumentStore {
  // Full list of documents opened in this browser session.
  openDocuments: Document[];

  // IDs of open documents that should currently be shown in the workspace UI.
  visibleDocumentIds: DocumentId[];

  // The document the user is selected.
  activeDocumentId: DocumentId | null;

  // Actions are functions that update the store.
  removeDocument: (id: DocumentId) => void;
  setOpenDocuments: (documents: Document[]) => void;
  setVisibleDocumentIds: (ids: DocumentId[]) => void;
  setActiveDocumentId: (id: DocumentId | null) => void;
  addDocument: (title: string, content: string) => void;
  addTEIDocument: (doc: TEIDoc) => void;
}

// A document search can actually run against: the TEI variant of Document, so
// callers reach `content.id` (the backend TEI id search needs) without a cast.
export type SearchableDocument = Extract<Document, { format: "tei" }>;

/**
 * The documents a search should currently run against: every visible column
 * that holds a TEI document, in visible order. Search is TEI-only end to end,
 * so `.txt`/`.docx` columns are never searchable.
 *
 * Both search triggers (the toolbar's Search button and the select-to-search
 * floating button) go through here. `excludedDocId` is what the selection
 * trigger adds: the query came out of that document, so searching it for its
 * own text would only find the text itself.
 *
 * The result can legitimately be empty (the source document was the only
 * visible TEI one) — callers decide what that means for them.
 */
export function getSearchableDocuments(
  state: Pick<DocumentStore, "openDocuments" | "visibleDocumentIds">,
  options: { excludedDocId?: DocumentId } = {},
): SearchableDocument[] {
  return getVisibleTEIDocuments(state).filter(
    (doc) => doc.id !== options.excludedDocId,
  );
}

/**
 * Every visible column holding a TEI document, in the order they are on screen.
 *
 * The column order is part of the answer, not incidental: the Tag Filter prints
 * one occurrence count per column (`12 · 111 · 72`) and they have to line up
 * with what the reader sees.
 */
export function getVisibleTEIDocuments(
  state: Pick<DocumentStore, "openDocuments" | "visibleDocumentIds">,
): SearchableDocument[] {
  return state.visibleDocumentIds
    .map((id) => state.openDocuments.find((doc) => doc.id === id))
    .filter((doc): doc is SearchableDocument => doc?.format === "tei");
}

/** The workspace column id a backend TEI document id is opened under. */
export function teiDocumentId(backendId: number): DocumentId {
  return `doc-tei-${backendId}`;
}

export interface TEIOpenPlan {
  /** Backend ids that need a column, and have one, in request order. */
  toOpen: number[];
  /**
   * Requested ids that are on screen already. They need no column and no
   * fetch — re-opening one only re-focuses it — and they are counted apart
   * from `toOpen` so a report of what happened cannot claim to have opened a
   * document that was open before the click.
   */
  alreadyOpen: number[];
  /** Requested ids there was no room for. */
  skipped: number[];
}

/**
 * Which of the requested TEI documents the workspace has room for.
 *
 * Opening a work is one action over several documents, so the cap has to be
 * answered once, up front — the alternative is fetching all of them and letting
 * `addTEIDocument` quietly drop the ones that no longer fit, leaving nobody able
 * to say what was opened and what was not (#152).
 *
 * A document that is already open costs nothing: re-opening it re-focuses its
 * existing column rather than adding one.
 */
export function planTEIOpen(
  state: Pick<DocumentStore, "openDocuments">,
  requestedIds: number[],
): TEIOpenPlan {
  const alreadyOpen = new Set(state.openDocuments.map((doc) => doc.id));
  let free = MAX_OPEN_DOCUMENTS - state.openDocuments.length;

  const plan: TEIOpenPlan = { toOpen: [], alreadyOpen: [], skipped: [] };
  // A repeated id is one document: it must not be fetched twice, nor inflate
  // the "opened 3 of 5" the caller reports.
  for (const id of new Set(requestedIds)) {
    if (alreadyOpen.has(teiDocumentId(id))) {
      plan.alreadyOpen.push(id);
    } else if (free > 0) {
      free -= 1;
      plan.toOpen.push(id);
    } else {
      plan.skipped.push(id);
    }
  }
  return plan;
}

const initialDocuments: Document[] = [];

export const useDocumentStore = create<DocumentStore>((set) => ({
  // Initial state:
  openDocuments: initialDocuments,
  visibleDocumentIds: initialDocuments
    .slice(0, MAX_VISIBLE_DOCUMENTS)
    .map((doc) => doc.id),
  activeDocumentId: initialDocuments[0]?.id ?? null,

  // Update the list by replacing the whole list.
  setOpenDocuments: (documents) =>
    set({
      openDocuments: documents,
    }),

  // Update the list by replacing the whole list.
  setVisibleDocumentIds: (ids) =>
    set({
      visibleDocumentIds: ids,
    }),

  setActiveDocumentId: (id) =>
    set({
      activeDocumentId: id,
    }),

  // Close a document by removing its id from both:
  // - openDocuments: the actual list of opened documents
  // - visibleDocumentIds: the list of documents currently shown in the UI
  removeDocument: (id) =>
    set((state) => {
      // log the closed doc's title before it's filtered out
      const closedDoc = state.openDocuments.find((doc) => doc.id === id);
      if (closedDoc) {
        logDocEvent("document_closed", closedDoc.id, closedDoc.title);
      }

      const newOpen = state.openDocuments.filter((doc) => doc.id !== id);
      const newVisible = state.visibleDocumentIds.filter(
        (visId) => visId !== id,
      );
      return {
        openDocuments: newOpen,
        visibleDocumentIds: newVisible,
      };
    }),

  // Add a plain text document to the workspace.
  // This is separate from addTEIDocument because text documents store content
  // as a string, while TEI documents store a parsed TEIDoc object.
  addDocument: (title, content) =>
    set((state) => {
      if (state.openDocuments.length >= MAX_OPEN_DOCUMENTS) {
        return state;
      }

      // Generate a unique id for this document.
      const id = `doc-${Date.now()}`;
      const newDoc: Document = {
        id,
        title,
        format: "txt",
        content,
      };

      logDocEvent("document_opened", id, title);

      // Add this to the end of the open document list.
      const newOpen = [...state.openDocuments, newDoc];

      // If there is room in the visible area, show the new document immediately.
      // If the visible area is full, the document is opened but not added to
      // visibleDocumentIds.
      const newVisible =
        state.visibleDocumentIds.length < MAX_VISIBLE_DOCUMENTS
          ? [...state.visibleDocumentIds, id]
          : state.visibleDocumentIds;

      // Make the newly added document the active one.
      return {
        openDocuments: newOpen,
        visibleDocumentIds: newVisible,
        activeDocumentId: id,
      };
    }),

  // Add a TEI document to the workspace.
  // The TEI picker fetches a complete TEIDoc from the backend, then calls this.
  addTEIDocument: (doc) =>
    set((state) => {
      // backend return TEIDoc -> Convert to Document type -> Add to document store -> UserInterface shows the document from the documentstore.
      const id = `doc-tei-${doc.id}`;
      // Open each TEI document at most once. If it is already open, re-focus the
      // existing column (and make sure it is visible) instead of adding a duplicate.
      if (state.openDocuments.some((d) => d.id === id)) {
        return {
          activeDocumentId: id,
          visibleDocumentIds: state.visibleDocumentIds.includes(id)
            ? state.visibleDocumentIds
            : [...state.visibleDocumentIds, id],
        };
      }
      if (state.openDocuments.length >= MAX_OPEN_DOCUMENTS) {
        return state;
      }

      // backend return TEIDoc -> Convert to Document type -> Add to document store -> User Interface shows the document from the documentstore.
      const newDoc: Document = {
        id,
        title: doc.title,
        format: "tei",
        content: doc,
      };

      // a genuinely new open, not the re-focus branch above
      logDocEvent("document_opened", id, doc.title);

      // Add the TEI document to the list of open documents.
      const newOpen = [...state.openDocuments, newDoc];

      // Show it immediately only if the visible document area still has room.
      const newVisible =
        state.visibleDocumentIds.length < MAX_VISIBLE_DOCUMENTS
          ? [...state.visibleDocumentIds, id]
          : state.visibleDocumentIds;

      // update active document id.
      return {
        openDocuments: newOpen,
        visibleDocumentIds: newVisible,
        activeDocumentId: id,
      };
    }),
}));
