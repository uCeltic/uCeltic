import { create } from "zustand";
import { markTourDismissed } from "../workspace/tour/tourStorage";
import { TOUR_STEPS } from "../workspace/tour/tourSteps";
import {
  clearLatchesAfterBoundary,
  latchProgress,
  type TourSignals,
} from "../workspace/tour/tourProgress";

/**
 * Drives the onboarding spotlight tour (#125, #177). Shared state, because the
 * Help button that re-opens the tour lives in ToolBar while the tour overlay
 * itself renders in WorkspaceLayout — they meet through this store rather than a
 * prop threaded across the layout.
 *
 * What it does *not* hold is the step showing. That is derived from the
 * workspace itself (tourProgress.ts): the tour advances because the reader
 * opened a second document or finished a search, not because this store was
 * told to. All this store keeps is the two things derivation cannot know — how
 * far Next and Back have been pressed, and which steps have been taught for
 * good.
 *
 * Finishing or skipping the tour records the dismissal (localStorage) so the
 * first-run auto-show never fires again; the Help button re-opens it regardless.
 */
interface TourState {
  isOpen: boolean;
  /**
   * How far Next and Back have carried the reader. Only a floor: the step shown
   * is `max(derived, manualIndex)`, so this can jump ahead of the workspace but
   * never behind it.
   */
  manualIndex: number;
  /** Per step: taught for good, whatever the workspace looks like now. */
  latched: boolean[];
  /**
   * Open the tour (first-run auto-show, and the Help button). Steps after the
   * search are taught again — a reader coming back mid-session keeps the
   * opening steps they have already performed, and the workspace is untouched
   * either way.
   */
  start: () => void;
  /** Fold this snapshot of the workspace into what the tour treats as taught. */
  syncProgress: (signals: TourSignals) => void;
  /** Advance from the step showing; on the last step this finishes the tour. */
  next: (from: number) => void;
  back: (from: number) => void;
  /** Close and persist the dismissal (Skip, or Done on the last step). */
  end: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  isOpen: false,
  manualIndex: 0,
  latched: [],
  start: () =>
    set((s) => ({
      isOpen: true,
      manualIndex: 0,
      latched: clearLatchesAfterBoundary(TOUR_STEPS, s.latched),
    })),
  syncProgress: (signals) =>
    set((s) => {
      const latched = latchProgress(TOUR_STEPS, signals, s.latched);
      // Signals are re-read on every store change; keep the old array when
      // nothing new was taught so subscribers see no change at all.
      const changed = latched.some((value, i) => value !== s.latched[i]);
      return changed ? { latched } : {};
    }),
  next: (from) => {
    if (from >= TOUR_STEPS.length - 1) {
      get().end();
      return;
    }
    set({ manualIndex: from + 1 });
  },
  back: (from) => set({ manualIndex: Math.max(0, from - 1) }),
  end: () => {
    markTourDismissed();
    set({ isOpen: false });
  },
}));
