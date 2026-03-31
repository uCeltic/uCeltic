import { create } from 'zustand'
import type { Manuscript, ManuscriptId } from '../types/manuscript'

export const MAX_OPEN_MANUSCRIPTS = 8
export const MAX_VISIBLE_MANUSCRIPTS = 8

interface ManuscriptStore {
    openManuscripts: Manuscript[]
    visibleManuscriptIds: ManuscriptId[]
    activeManuscriptId: ManuscriptId | null
    setOpenManuscripts: (manuscripts: Manuscript[]) => void
    setVisibleManuscriptIds: (ids: ManuscriptId[]) => void
    setActiveManuscriptId: (id: ManuscriptId | null) => void
  }

const initialManuscripts: Manuscript[] = [
    {
        id: 'ms-1',
        title: 'Manuscript 1',
        format: 'txt',
        content: 'Sample content for manuscript 1',
    },
    {
        id: 'ms-2',
        title: 'Manuscript 2',
        format: 'xml',
        content: 'Sample content for manuscript 2',
    },
    {
        id: 'ms-3',
        title: 'Manuscript 3',
        format: 'docx',
        content: 'Sample content for manuscript 3',
    },
]

export const useManuscriptStore = create<ManuscriptStore>((set) => ({
    openManuscripts: initialManuscripts,
    visibleManuscriptIds: initialManuscripts
      .slice(0, MAX_VISIBLE_MANUSCRIPTS)
      .map((manuscript) => manuscript.id),
    activeManuscriptId: initialManuscripts[0]?.id ?? null,

    setOpenManuscripts: (manuscripts) =>
      set({
        openManuscripts: manuscripts,
      }),

    setVisibleManuscriptIds: (ids) =>
      set({
        visibleManuscriptIds: ids,
      }),

    setActiveManuscriptId: (id) =>
      set({
        activeManuscriptId: id,
      }),
  }))