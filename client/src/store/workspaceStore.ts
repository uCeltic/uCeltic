import { create } from 'zustand'
import type { WorkspaceStatus } from '../types/panel'

interface WorkspaceStore {
  status: WorkspaceStatus
  statusText: string
  setStatus: (status: WorkspaceStatus, statusText?: string) => void
  setStatusText: (text: string) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  status: 'ready',
  statusText: 'Ready',

  setStatus: (status, statusText) =>
    set({
      status,
      statusText: statusText ?? status,
    }),

  setStatusText: (text) =>
    set({
      statusText: text,
    }),
}))
