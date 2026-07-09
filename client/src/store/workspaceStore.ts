import { create } from "zustand";
import type { WorkspaceStatus } from "../types/panel";
import { logEvent } from "../api/log";

export type WorkspaceMode = "search" | "entities" | "personal";

export const MODE_LABELS: Record<WorkspaceMode, string> = {
  search: "Search",
  entities: "People & Places",
  personal: "Personal",
};

// no-op guards, mirroring searchStore's logParamChange — skip logging when
// the value didn't actually change (re-picked mode, clamped font size, same scope)
function logModeChanged(from: WorkspaceMode, to: WorkspaceMode): void {
  if (to === from) return;
  logEvent("mode_changed", { from, to });
}

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

  // mode
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
  selectedWorkIds: string[];
  setSelectedWorkIds: (ids: string[]) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  status: "ready",
  statusText: "Ready",
  fontSize: 14,
  showIIIF: true,
  mode: "search",
  selectedWorkIds: [],

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
  setMode: (mode) => {
    logModeChanged(get().mode, mode);
    set({ mode });
  },
  setSelectedWorkIds: (ids) => {
    if (!sameWorkIds(get().selectedWorkIds, ids)) {
      logEvent("scope_changed", { selected_work_ids: ids });
    }
    set({ selectedWorkIds: ids });
  },
}));
