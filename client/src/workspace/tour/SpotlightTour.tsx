import { useEffect, useState } from "react";
import { useTourStore } from "../../store/tourStore";
import { TOUR_STEPS } from "./tourSteps";
import { tourDismissedBefore } from "./tourStorage";

// Padding between an anchor's edge and the spotlight ring around it.
const RING_PAD = 6;
// Gap between the ring and the copy card that sits beside it.
const CARD_GAP = 12;
const CARD_WIDTH = 320;

// The card's own controls, not toolbar buttons, so they don't reuse the
// toolbar's shape from buttonStyles.ts (different padding, no icon slot). They
// do share this one focus ring, matched to the rest of the app's `#52524F` keys.
const CARD_FOCUS_RING =
  "cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

// The box that encloses every currently-rendered anchor of a step — *every*
// match, not just the first, so the per-column result nav (one `result-nav` per
// open column) is ringed across all its columns, not only the leftmost. A
// selector matching nothing (the floating search button before a selection, the
// result nav before a search) contributes nothing; when none match, there is
// nothing to ring and the card falls back to a fixed position (see below).
function measureAnchors(anchors: string[]): Box | null {
  let box: Box | null = null;
  for (const anchor of anchors) {
    for (const el of document.querySelectorAll(`[data-tour="${anchor}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      box = box
        ? {
            top: Math.min(box.top, r.top),
            left: Math.min(box.left, r.left),
            right: Math.max(box.right, r.right),
            bottom: Math.max(box.bottom, r.bottom),
          }
        : { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    }
  }
  return box;
}

function boxesEqual(a: Box | null, b: Box | null): boolean {
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
 * The onboarding spotlight tour overlay (#125).
 *
 * Non-blocking by construction: the whole overlay is `pointer-events-none` except
 * the copy card, so the dimmed page underneath stays fully interactive — the user
 * opens documents and selects text (bringing the ephemeral anchors on screen)
 * without leaving the tour. The dim + cutout is a single element's giant
 * box-shadow, purely cosmetic.
 *
 * Anchor rects are re-measured every animation frame while the tour is open, so
 * the ring tracks scrolling and snaps onto anchors that appear mid-step (the
 * floating select-to-search button, the per-column result nav).
 */
export default function SpotlightTour() {
  const isOpen = useTourStore((s) => s.isOpen);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const start = useTourStore((s) => s.start);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const end = useTourStore((s) => s.end);

  const [box, setBox] = useState<Box | null>(null);

  // First-run auto-show: open once, unless a previous finish/skip was recorded.
  useEffect(() => {
    if (!tourDismissedBefore()) start();
  }, [start]);

  const step = TOUR_STEPS[stepIndex];

  // Track the current step's anchor box across scrolling and late-appearing
  // anchors. rAF (not scroll/resize listeners) because the anchors can appear or
  // move for reasons that fire no event — a search finishing, a column closing.
  useEffect(() => {
    if (!isOpen || !step) return;
    let frame = 0;
    let current: Box | null = null;
    const tick = () => {
      const measured = measureAnchors(step.anchors);
      if (!boxesEqual(measured, current)) {
        current = measured;
        setBox(measured);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, step]);

  if (!isOpen || !step) return null;

  const isLast = stepIndex === TOUR_STEPS.length - 1;

  // Card placement: below the ring when there's room, above it otherwise; centred
  // near the top when the step has no on-screen anchor yet.
  const cardStyle: React.CSSProperties = box
    ? (() => {
        const belowRoom = window.innerHeight - box.bottom;
        const top =
          belowRoom > 180
            ? box.bottom + RING_PAD + CARD_GAP
            : Math.max(CARD_GAP, box.top - RING_PAD - CARD_GAP - 180);
        const left = Math.min(
          Math.max(CARD_GAP, box.left),
          Math.max(CARD_GAP, window.innerWidth - CARD_WIDTH - CARD_GAP),
        );
        return { top, left, width: CARD_WIDTH };
      })()
    : {
        top: 24,
        left: "50%",
        width: CARD_WIDTH,
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
              onClick={back}
              disabled={stepIndex === 0}
              className={`rounded-md border border-[#E5E2D6] bg-white px-3 py-1 text-sm font-medium text-[#52524F] hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:opacity-50 ${CARD_FOCUS_RING}`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
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
