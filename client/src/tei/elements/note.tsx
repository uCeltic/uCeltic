import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TEIElementProps } from "../elementMap";
import { placeNotePanel, type NotePanelPlacement } from "../notePanelPosition";

/**
 * How long the panel survives the pointer leaving it (#166).
 *
 * There is a gap between the marker and the panel, and the pointer has to cross
 * it — leaving the marker is not the same as being finished with the note. So
 * closing is deferred, and entering either the marker or the panel cancels it.
 */
export const CLOSE_DELAY_MS = 200;

/**
 * An editorial note: a numbered superscript marker, and the panel it opens.
 *
 * The marker is the one place in the reading pane that keeps its colour (#153,
 * ADR-0016 and ADR-0018's one exemption). It is not the manuscript's text — it
 * is the affordance saying "there is a note here, open it" — and it carries the
 * note's number rather than a bare `*` (#154), so a reader can say which note
 * they mean. The marker stays nested inside the `sup`: search highlighting
 * resolves offsets against the text nodes whose parent IS the anchor, so a
 * marker one level down counts toward neither the note's own offsets nor the
 * enclosing `l`'s. `leading-none` keeps the larger size from opening up the
 * verse lines it sits at the start of.
 *
 * `TEIRenderer` numbers every note it paints, so the `*` is only what an
 * unnumbered note falls back to. It is there because the alternative is an empty
 * `sup`: a marker with no glyph is nothing to hover, and the note would go
 * missing silently rather than reading the way it used to.
 *
 * **The panel is portalled to `document.body`** (#166). It used to be absolutely
 * positioned inside the column, which is `overflow: auto` — a clipping box that
 * cuts off an absolutely positioned descendant whatever its `z-index`. Leaving
 * the box is the only fix, and three things follow from it, all of them wanted:
 *
 * - The panel takes the pointer, so a 263-character note can be read, selected
 *   and copied, and scrolls inside its own box when it outgrows its room.
 * - It is positioned against the viewport, so a note at a column's right edge
 *   opens fully — over the neighbouring column if that is what it takes.
 * - Select-to-search scopes itself to `[data-tei-content]`, which the panel is
 *   now outside of, so selecting a note's text offers nothing. That is correct:
 *   a note is the editor's commentary, and the search index dropped it too
 *   (backend `SKIP_TAGS`).
 *
 * The note's children only exist in the DOM while the panel is open. Nothing
 * that resolves a search result or an entity occurrence looks for them: both
 * search over the column, and a `note` subtree is outside the index either way.
 */
export function Note({ children, anchorId, noteNumber }: TEIElementProps) {
  const markerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Where the panel is, and whether it is open at all: an open panel always has
  // somewhere to be, so the two are one piece of state rather than a flag and a
  // position that could disagree.
  const [placement, setPlacement] = useState<NotePanelPlacement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const measure = useCallback(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const rect = marker.getBoundingClientRect();
    // The column scrolled its marker away. A fixed panel does not scroll with
    // it, so following it here would leave the panel floating over the page
    // pointing at nothing; it goes with the marker instead.
    if (!withinClipBox(rect, clipBoxOf(marker))) return setPlacement(null);
    setPlacement(
      placeNotePanel(rect, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, []);

  function openPanel() {
    clearTimeout(closeTimer.current);
    measure();
  }

  function closeSoon() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      // Selecting a note's last line means dragging past the panel's edge, and
      // copying from the context menu means leaving the panel entirely — both
      // fire `mouseleave`. A panel still holding a live selection has not been
      // finished with, so it waits rather than closing and taking the selection
      // down with it. The wait ends when the selection does.
      if (holdsSelection(panelRef.current)) return closeSoon();
      setPlacement(null);
    }, CLOSE_DELAY_MS);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Fixed coordinates are measured once and then go stale, and the marker moves
  // whenever its column scrolls. Capture phase: an inner scroller's scroll event
  // does not bubble to the window. Subscribed on open/close rather than on every
  // measurement, so a scroll does not resubscribe the listener that ran it.
  const open = placement !== null;
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  return (
    <span className="inline-block" data-tei-tag="note" data-tei-anchor-id={anchorId}>
      <sup
        ref={markerRef}
        className="cursor-help select-none text-sm leading-none text-blue-500"
        onMouseEnter={openPanel}
        onMouseLeave={closeSoon}
      >
        {noteNumber ?? "*"}
      </sup>
      {placement &&
        createPortal(
          <div
            ref={panelRef}
            data-tei-note-panel
            // Light paper, not the cold grey it used to be: the column is
            // `#f5f6ee` and the controls `#FAF9F3`/`#F0EEE6`, and the panel was
            // the one dark surface in the interface. The hairline border and the
            // shadow are what say "floating" now that the contrast does not.
            className="fixed z-50 select-text overflow-y-auto rounded border
              border-[#D8D4C3] bg-[#FAF9F3] p-2 text-xs leading-4 text-[#52524F] shadow-lg"
            style={{
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
              top: placement.top,
              bottom: placement.bottom,
            }}
            onMouseEnter={openPanel}
            onMouseLeave={closeSoon}
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The box the workspace clips the marker to: every scrolling ancestor
 * intersected, bounded by the viewport.
 *
 * It is every one of them, not the nearest, because the marker now has a
 * scroller per axis — its column scrolls the text vertically, and the strip
 * around the columns scrolls sideways (ADR-0019). The strip carrying a column
 * off its edge hides the marker just as surely as the column scrolling it past
 * its own top, and the column's box moves with the strip, so it cannot see that
 * happen on its own.
 *
 * A box with no height was never laid out (a column still measuring itself, or
 * a test's detached DOM), and an unmeasured box clips nothing, so the walk
 * carries on past it.
 */
function clipBoxOf(marker: Element): Box {
  let box: Box = {
    top: 0,
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
  };
  for (let el = marker.parentElement; el; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el);
    if (!scrolls(overflowX) && !scrolls(overflowY)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) continue;
    box = {
      top: Math.max(box.top, rect.top),
      bottom: Math.min(box.bottom, rect.bottom),
      left: Math.max(box.left, rect.left),
      right: Math.min(box.right, rect.right),
    };
  }
  return box;
}

function scrolls(overflow: string): boolean {
  return overflow === "auto" || overflow === "scroll";
}

/** Whether any part of the marker is still inside the box that clips it. */
function withinClipBox(marker: Box, box: Box): boolean {
  return (
    marker.bottom >= box.top &&
    marker.top <= box.bottom &&
    marker.right >= box.left &&
    marker.left <= box.right
  );
}

/** Whether a live, non-empty selection lies inside `panel`. */
function holdsSelection(panel: HTMLElement | null): boolean {
  const selection = window.getSelection();
  if (!panel || !selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  return panel.contains(selection.getRangeAt(0).commonAncestorContainer);
}
