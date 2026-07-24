import { create } from "zustand";
import { markTourDismissed } from "../workspace/tour/tourStorage";
import { TOUR_STEPS } from "../workspace/tour/tourSteps";

/**
 * Drives the onboarding spotlight tour (#125). Shared state, because the Help
 * button that re-opens the tour lives in ToolBar while the tour overlay itself
 * renders in WorkspaceLayout — they meet through this store rather than a prop
 * threaded across the layout.
 *
 * Finishing or skipping the tour records the dismissal (localStorage) so the
 * first-run auto-show never fires again; the Help button re-opens it regardless.
 */
interface TourState {
  isOpen: boolean;
  stepIndex: number;
  /** Open the tour at step 0 (used by first-run auto-show and the Help button). */
  start: () => void;
  /** Advance; on the last step this finishes and dismisses the tour. */
  next: () => void;
  back: () => void;
  /** Close and persist the dismissal (Skip, or Done on the last step). */
  end: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  isOpen: false,
  stepIndex: 0,
  start: () => set({ isOpen: true, stepIndex: 0 }),
  next: () => {
    if (get().stepIndex >= TOUR_STEPS.length - 1) {
      get().end();
      return;
    }
    set((s) => ({ stepIndex: s.stepIndex + 1 }));
  },
  back: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  end: () => {
    markTourDismissed();
    set({ isOpen: false });
  },
}));
