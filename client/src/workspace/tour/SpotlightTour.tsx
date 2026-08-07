import { useEffect, useState } from "react";
import { useTourStore } from "../../store/tourStore";
import { TOUR_STEPS } from "./tourSteps";
import { tourDismissedBefore } from "./tourStorage";
import { deriveStepIndex, visibleStepIndex } from "./tourProgress";
import { useTourSignals } from "./tourSignals";
import {
  CARD_GAP,
  RING_PAD,
  TOUR_CARD_WIDTH,
  placeTourCard,
  type Rect,
} from "./tourCardPlacement";

// The card's own controls, not toolbar buttons, so they don't reuse the
// toolbar's shape from buttonStyles.ts (different padding, no icon slot). They
// do share this one focus ring, matched to the rest of the app's `#52524F` keys.
const CARD_FOCUS_RING =
  "cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

// The box that encloses every currently-rendered anchor of a step — *every*
// match, not just the first, so the per-column result nav (one `result-nav` per
// open column) is ringed across all its columns, not only the leftmost. A
// selector matching nothing (the floating search button before a selection, the
// result nav before a search) contributes nothing; when none match, there is
// nothing to ring and the card falls back to a fixed position (see below).
function measureAnchors(anchors: string[]): Rect | null {
  let box: Rect | null = null;
  for (const anchor of anchors) {
    for (const el of document.querySelectorAll(`[data-tour="${anchor}"]`)) {
      box = grow(box, el);
    }
  }
  return box;
}

/**
 * The dropdown the ringed control has open, if any: the card has to keep clear
 * of it as well as of the ring (tourCardPlacement.ts).
 *
 * Only a panel touching the ring counts. A dropdown hangs directly off the
 * button that opens it, so it always touches; a panel open elsewhere on the
 * toolbar is somebody else's and must not drag the card across the screen.
 */
function measurePanel(ring: Rect | null): Rect | null {
  if (!ring) return null;
  let box: Rect | null = null;
  for (const el of document.querySelectorAll("[data-tour-panel]")) {
    const r = el.getBoundingClientRect();
    if (
      r.left > ring.right + RING_PAD ||
      r.right < ring.left - RING_PAD ||
      r.top > ring.bottom + RING_PAD ||
      r.bottom < ring.top - RING_PAD
    ) {
      continue;
    }
    box = grow(box, el);
  }
  return box;
}

function grow(box: Rect | null, el: Element): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return box;
  return box
    ? {
        top: Math.min(box.top, r.top),
        left: Math.min(box.left, r.left),
        right: Math.max(box.right, r.right),
        bottom: Math.max(box.bottom, r.bottom),
      }
    : { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
}

function boxesEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.right === b.right &&
    a.bottom === b.bottom
  );
}

/**
 * The onboarding spotlight tour overlay (#125), which advances as the workspace
 * changes (#177, ADR-0022).
 *
 * The step showing is not this component's decision, nor the store's: it is
 * derived from the workspace itself (tourProgress.ts), so opening a second
 * document or finishing a search moves the card with no press of Next. All this
 * component does is read the live signals, fold them into what the tour treats
 * as taught, and render the step that comes out.
 *
 * Non-blocking by construction: the whole overlay is `pointer-events-none` except
 * the copy card, so the dimmed page underneath stays fully interactive — the user
 * opens documents and selects text (bringing the ephemeral anchors on screen)
 * without leaving the tour. That is also what makes an advancing tour possible:
 * every step's action is performed on the page the tour is drawn over. The dim +
 * cutout is a single element's giant box-shadow, purely cosmetic.
 *
 * Anchor rects are re-measured every animation frame while the tour is open, so
 * the ring tracks scrolling and snaps onto anchors that appear mid-step (the
 * floating select-to-search button, the per-column result nav).
 */
export default function SpotlightTour() {
  const isOpen = useTourStore((s) => s.isOpen);
  const manualIndex = useTourStore((s) => s.manualIndex);
  const latched = useTourStore((s) => s.latched);
  const start = useTourStore((s) => s.start);
  const syncProgress = useTourStore((s) => s.syncProgress);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const end = useTourStore((s) => s.end);

  const signals = useTourSignals();

  const [box, setBox] = useState<Rect | null>(null);
  const [panel, setPanel] = useState<Rect | null>(null);

  // First-run auto-show: open once, unless a previous finish/skip was recorded.
  useEffect(() => {
    if (!tourDismissedBefore()) start();
  }, [start]);

  // Remember what the workspace has taught while the tour is watching. Only
  // while it is open: a workspace used with the tour closed teaches the tour
  // nothing, and re-opening from Help is what decides where to resume.
  useEffect(() => {
    if (isOpen) syncProgress(signals);
  }, [isOpen, signals, syncProgress]);

  // The floor the workspace itself sets, and the step actually on screen. Back
  // stops at the floor rather than pretending to move: below it, the next frame
  // would derive the same step again.
  const derivedIndex = deriveStepIndex(TOUR_STEPS, signals, latched);
  const stepIndex = visibleStepIndex(TOUR_STEPS, signals, latched, manualIndex);
  const step = TOUR_STEPS[stepIndex];

  // Track the current step's anchor box across scrolling and late-appearing
  // anchors. rAF (not scroll/resize listeners) because the anchors can appear or
  // move for reasons that fire no event — a search finishing, a column closing.
  useEffect(() => {
    if (!isOpen || !step) return;
    let frame = 0;
    let currentBox: Rect | null = null;
    let currentPanel: Rect | null = null;
    const tick = () => {
      const measured = measureAnchors(step.anchors);
      if (!boxesEqual(measured, currentBox)) {
        currentBox = measured;
        setBox(measured);
      }
      const measuredPanel = measurePanel(measured);
      if (!boxesEqual(measuredPanel, currentPanel)) {
        currentPanel = measuredPanel;
        setPanel(measuredPanel);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, step]);

  if (!isOpen || !step) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;

  // Beside the ring, never on top of what the step asks the reader to use; a
  // step with no on-screen anchor yet has nothing to sit beside, so the card
  // waits near the top.
  const cardStyle: React.CSSProperties = box
    ? {
        ...placeTourCard(box, panel, {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
        width: TOUR_CARD_WIDTH,
      }
    : {
        top: CARD_GAP,
        left: "50%",
        width: TOUR_CARD_WIDTH,
        transform: "translateX(-50%)",
      };

  return (
    <div
      // pointer-events-none: the tour never traps the page beneath it (same
      // non-blocking guarantee EntryNotice's test asserts). Only the card opts
      // back in.
      className="pointer-events-none fixed inset-0 z-[60]"
      data-testid="spotlight-tour"
    >
      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-white/90 transition-all duration-200"
          style={{
            top: box.top - RING_PAD,
            left: box.left - RING_PAD,
            width: box.right - box.left + RING_PAD * 2,
            height: box.bottom - box.top + RING_PAD * 2,
            boxShadow: "0 0 0 9999px rgba(23,23,23,0.55)",
          }}
        />
      )}

      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        className="pointer-events-auto fixed rounded-lg border border-[#D8D4C3] bg-white p-4 shadow-xl"
        style={cardStyle}
      >
        <p className="text-xs font-medium text-[#8A8778]">
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-base font-semibold text-[#52524F]">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-[#6B6B67]">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={end}
            className={`rounded-md px-2 py-1 text-sm font-medium text-[#8A8778] hover:bg-[#F0EEE6] ${CARD_FOCUS_RING}`}
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => back(stepIndex)}
              disabled={stepIndex <= derivedIndex}
              className={`rounded-md border border-[#E5E2D6] bg-white px-3 py-1 text-sm font-medium text-[#52524F] hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:opacity-50 ${CARD_FOCUS_RING}`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => next(stepIndex)}
              className={`rounded-md border border-[#52524F] bg-[#52524F] px-3 py-1 text-sm font-medium text-white hover:bg-[#3F3F3C] ${CARD_FOCUS_RING}`}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
