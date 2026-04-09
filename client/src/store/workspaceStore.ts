import { create } from "zustand";
import type { WorkspaceStatus } from "../types/panel";

interface WorkspaceStore {
  status: WorkspaceStatus;
  statusText: string;
  fontSize: number;
  setStatus: (status: WorkspaceStatus, statusText?: string) => void;
  setStatusText: (text: string) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  status: "ready",
  statusText: "Ready",
  fontSize: 14,

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
}));
