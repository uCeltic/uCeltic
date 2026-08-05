import { create } from "zustand";
import { listNameEntities } from "../api/tei";
import type { NameEntity } from "../types/tei";

/**
 * The corpus-wide name register, fetched once per session (#163).
 *
 * It is a property of the corpus, not of the workspace: the same 91 entries
 * whichever columns are open, whichever Work is chosen. So it is fetched once
 * and held, and the narrowing — which of them the Tag Filter offers, and what
 * each visible column counts — happens against the open documents in
 * `useEntityMenu`. Re-fetching on every column change would re-ask a question
 * whose answer cannot have moved.
 *
 * A failed load leaves the register empty. That reads as "no named entities to
 * filter by yet", which is the same honest empty state as a corpus that groups
 * its names but explains none of them — the menu offers nothing rather than
 * something stale, and the reading panes are untouched either way.
 */
interface NameRegistryStore {
  entities: NameEntity[];
  /**
   * Whether a fetch has been started and not failed. Held in the store rather
   * than in a module variable so it resets with the rest of the state — a guard
   * nothing can put back is a guard that outlives what it was guarding.
   */
  requested: boolean;
  /** Fetch the register, at most once. Safe to call from every render. */
  load: () => void;
}

export const useNameRegistryStore = create<NameRegistryStore>((set, get) => ({
  entities: [],
  requested: false,

  load: () => {
    if (get().requested) return;
    set({ requested: true });
    listNameEntities()
      .then((entities) => set({ entities }))
      // Left empty on purpose; the menu says so. Nothing else in the workspace
      // depends on the register, so a failure costs the Tag Filter and nothing
      // more — and clearing the guard lets the next reader who opens the menu
      // try again, rather than freezing the session out of it.
      .catch(() => set({ requested: false }));
  },
}));
