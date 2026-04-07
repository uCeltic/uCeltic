import { create } from "zustand";
import type { Manuscript, ManuscriptId } from "../types/manuscript";

export const MAX_OPEN_MANUSCRIPTS = 8;
export const MAX_VISIBLE_MANUSCRIPTS = 8;

interface ManuscriptStore {
  openManuscripts: Manuscript[];
  visibleManuscriptIds: ManuscriptId[];
  activeManuscriptId: ManuscriptId | null;
  setOpenManuscripts: (manuscripts: Manuscript[]) => void;
  setVisibleManuscriptIds: (ids: ManuscriptId[]) => void;
  setActiveManuscriptId: (id: ManuscriptId | null) => void;
  addManuscript: (title: string, content: string) => void;
}

const initialManuscripts: Manuscript[] = [];


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

  addManuscript: (title, content) =>
    set((state) => {
      if (state.openManuscripts.length >= MAX_OPEN_MANUSCRIPTS) {
        return state;
      }

      const id = `ms-${Date.now()}`;
      const newManuscript: Manuscript = {
        id,
        title,
        format: "txt",
        content,
      };

      const newOpen = [...state.openManuscripts, newManuscript];
      const newVisible =
        state.visibleManuscriptIds.length < MAX_VISIBLE_MANUSCRIPTS
          ? [...state.visibleManuscriptIds, id]
          : state.visibleManuscriptIds;

      return {
        openManuscripts: newOpen,
        visibleManuscriptIds: newVisible,
        activeManuscriptId: id,
      };
    }),
}));
