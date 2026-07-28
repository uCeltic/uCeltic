import { create } from "zustand";
import type { WorkspaceStatus } from "../types/panel";
import type { DocumentId } from "../types/document";
import { logEvent } from "../api/log";

// no-op guards, mirroring searchStore's logParamChange — skip logging when
// the value didn't actually change (clamped font size, same scope)
function logFontSizeChanged(from: number, to: number): void {
  if (to === from) return;
  logEvent("font_size_changed", { from, to });
}

function sameWorkIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

interface WorkspaceStore {
  // status
  status: WorkspaceStatus;
  statusText: string;
  setStatus: (status: WorkspaceStatus, statusText?: string) => void;
  setStatusText: (text: string) => void;

  // font size
  fontSize: number
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  
  // IIIF
  showIIIF: boolean
  toggleIIIF: () => void

  selectedWorkIds: string[];
  setSelectedWorkIds: (ids: string[]) => void;

  // Tag Filter — the id of the one person or place the reader is following, as
  // declared by the open documents' own authority lists (#147). Single-select:
  // the navigation below is over one entity's occurrences, so there is nothing
  // for a second selection to mean. `null` is "not following anyone".
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;

  // Which occurrence of that entity each column is sitting on. Per document,
  // because the three manuscripts share the entity but not its 12 / 111 / 72
  // occurrences — one column's `→` must never move another's.
  entityIndexByDocument: Record<DocumentId, number>;
  nextEntityOccurrence: (documentId: DocumentId, total: number) => void;
  prevEntityOccurrence: (documentId: DocumentId) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  status: "ready",
  statusText: "Ready",
  fontSize: 14,
  showIIIF: true,
  selectedWorkIds: [],
  selectedEntityId: null,
  entityIndexByDocument: {},

  setStatus: (status, statusText) =>
    set({
      status,
      statusText: statusText ?? status,
    }),

  setStatusText: (text) =>
    set({
      statusText: text,
    }),
  increaseFontSize: () =>
    set((state) => {
      const fontSize = Math.min(state.fontSize + 2, 24);
      logFontSizeChanged(state.fontSize, fontSize);
      return { fontSize };
    }),
  decreaseFontSize: () =>
    set((state) => {
      const fontSize = Math.max(state.fontSize - 2, 10);
      logFontSizeChanged(state.fontSize, fontSize);
      return { fontSize };
    }),
  toggleIIIF: () =>
    set((state) => {
      const showIIIF = !state.showIIIF;
      logEvent("iiif_toggled", { on: showIIIF });
      return { showIIIF };
    }),
  setSelectedEntityId: (id) => {
    if (get().selectedEntityId === id) return;
    logEvent("tag_entity_selected", { entity_id: id });
    // A different person is a different set of occurrences, so every column
    // starts again at its own first one rather than keeping a position that
    // belonged to somebody else.
    set({ selectedEntityId: id, entityIndexByDocument: {} });
  },

  nextEntityOccurrence: (documentId, total) =>
    set((state) => {
      const current = state.entityIndexByDocument[documentId] ?? 0;
      // Clamp rather than wrap, the same way search result navigation does.
      const next = Math.min(current + 1, Math.max(total - 1, 0));
      return {
        entityIndexByDocument: {
          ...state.entityIndexByDocument,
          [documentId]: next,
        },
      };
    }),

  prevEntityOccurrence: (documentId) =>
    set((state) => {
      const current = state.entityIndexByDocument[documentId] ?? 0;
      return {
        entityIndexByDocument: {
          ...state.entityIndexByDocument,
          [documentId]: Math.max(current - 1, 0),
        },
      };
    }),

  setSelectedWorkIds: (ids) => {
    if (!sameWorkIds(get().selectedWorkIds, ids)) {
      logEvent("scope_changed", { selected_work_ids: ids });
    }
    set({ selectedWorkIds: ids });
  },
}));
