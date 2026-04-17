import { create } from "zustand";
import type { WorkspaceStatus } from "../types/panel";

export type WorkspaceMode = "search" | "entities" | "personal";

export const MODE_LABELS: Record<WorkspaceMode, string> = {
  search: "Search",
  entities: "People & Places",
  personal: "Personal",
};

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

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
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
    set((state) => ({ fontSize: Math.min(state.fontSize + 2, 24) })),
  decreaseFontSize: () =>
    set((state) => ({ fontSize: Math.max(state.fontSize - 2, 10) })),
  toggleIIIF: () => set((state) => ({ showIIIF: !state.showIIIF })),
  setMode: (mode) => set({ mode }),
  setSelectedWorkIds: (ids) => set({ selectedWorkIds: ids })
}));
