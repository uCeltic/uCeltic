import { create } from "zustand";
import type { WorkspaceStatus } from "../types/panel";

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
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  status: "ready",
  statusText: "Ready",
  fontSize: 14,
  showIIIF: true,

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
}));
