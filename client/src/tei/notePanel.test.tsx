/**
 * #166 — the editorial note panel, once it stopped being clipped.
 *
 * The bug was never stacking. The panel was absolutely positioned inside the
 * column's `overflow: auto` scroll box, and an absolutely positioned descendant
 * is clipped by that box whatever its `z-index`. So the panel leaves the box
 * entirely: it is portalled to `document.body` and positioned `fixed` against
 * the marker's rect. That is what these tests hold — the panel is somewhere
 * else in the DOM than the text it belongs to.
 *
 * Three things follow from the portal, and all three are wanted: the pointer can
 * enter the panel (so a 263-character note can be read, selected and copied),
 * the panel scrolls rather than overflowing, and select-to-search — which scopes
 * itself to `[data-tei-content]` — cannot see the panel's text, because a note
 * is the editor's commentary, not the manuscript.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, type RenderResult } from "@testing-library/react";
import { CLOSE_DELAY_MS, Note } from "./elements/note";
import { readTEISelection } from "./selection";

const MARKER_RECT = { left: 400, right: 408, top: 500, bottom: 512 };

/**
 * A note as `DocumentArea` renders it: inside a TEI column whose content box
 * scrolls. `overflow: auto` is the clipping box the panel has to escape.
 */
function renderNoteInAColumn(body = "A patronymic."): RenderResult {
  return render(
    // The strip scrolls sideways once the columns stop fitting (ADR-0019), so
    // the marker has a scrolling ancestor on each axis — and both of them clip
    // it.
    <section data-column-strip style={{ overflowX: "auto" }}>
      <article data-doc-column-id="doc-1">
        <div data-tei-content style={{ overflowY: "auto" }}>
          <p>
            Find
            <Note node={{ tag: "note" }} anchorId={7} noteNumber={3}>
              {body}
            </Note>
          </p>
        </div>
      </article>
    </section>,
  );
}

/** The marker, with a bounding rect jsdom would otherwise report as all zeros. */
function marker(view: RenderResult, rect = MARKER_RECT): HTMLElement {
  const sup = view.container.querySelector("sup")!;
  vi.spyOn(sup, "getBoundingClientRect").mockReturnValue({
    ...rect,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON: () => "",
  });
  return sup as HTMLElement;
}

/** The open panel, or null when no note is showing one. */
function panel(): HTMLElement | null {
  return document.querySelector("[data-tei-note-panel]");
}

function open(view: RenderResult, rect = MARKER_RECT): HTMLElement {
  fireEvent.mouseEnter(marker(view, rect));
  return panel()!;
}

/** The column's scrolling content box, which is what clips the marker. */
function scrollBox(view: RenderResult): HTMLElement {
  return view.container.querySelector<HTMLElement>("[data-tei-content]")!;
}

/**
 * Give the column's scroll box a measured height. jsdom lays nothing out, so
 * without this it reports an empty rect — which clips nothing, by design.
 */
function scrollBoxSpans(
  view: RenderResult,
  { top, bottom }: { top: number; bottom: number },
): void {
  vi.spyOn(scrollBox(view), "getBoundingClientRect").mockReturnValue({
    top,
    bottom,
    left: 0,
    right: 600,
    width: 600,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => "",
  });
}

function scrollColumn(view: RenderResult): void {
  fireEvent.scroll(scrollBox(view));
}

/** The column strip, which clips the marker sideways (ADR-0019). */
function strip(view: RenderResult): HTMLElement {
  return view.container.querySelector<HTMLElement>("[data-column-strip]")!;
}

/** As `scrollBoxSpans`, for the strip's horizontal extent. */
function stripSpans(
  view: RenderResult,
  { left, right }: { left: number; right: number },
): void {
  vi.spyOn(strip(view), "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: 800,
    left,
    right,
    width: right - left,
    height: 800,
    x: left,
    y: 0,
    toJSON: () => "",
  });
}

/** Select the whole text of one element, the way a reader dragging over it does. */
function selectContentsOf(el: Element): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

beforeEach(() => {
  vi.useFakeTimers();
  window.innerWidth = 1200;
  window.innerHeight = 800;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the note panel escapes the column's scroll box", () => {
  it("is not painted until the marker is hovered", () => {
    renderNoteInAColumn();

    expect(panel()).toBeNull();
  });

  it("renders through a portal to the body, outside the scrolling column", () => {
    const view = renderNoteInAColumn();

    const el = open(view);

    expect(el).not.toBeNull();
    expect(view.container.contains(el)).toBe(false);
    expect(document.body.contains(el)).toBe(true);
    expect(el.closest("[data-tei-content]")).toBeNull();
  });

  it("carries the note's text", () => {
    const view = renderNoteInAColumn("Dúch caite.");

    expect(open(view).textContent).toBe("Dúch caite.");
  });

  // The reported symptom. A marker low in the column used to open a panel the
  // scroll box cut off; positioned against the viewport, the panel goes above it.
  it("positions itself against the viewport, not the column", () => {
    const view = renderNoteInAColumn();

    const el = open(view, { left: 400, right: 408, top: 780, bottom: 792 });

    expect(el.className).toContain("fixed");
    expect(el.style.bottom).not.toBe("");
    expect(el.style.top).toBe("");
  });

  // The second, unreported symptom: fixed-width and left-aligned to its marker,
  // so a note near a column's right edge had its right half cut off.
  it("pulls a panel opened at the right edge back inside the viewport", () => {
    const view = renderNoteInAColumn();

    const el = open(view, { left: 1190, right: 1198, top: 400, bottom: 412 });

    expect(parseFloat(el.style.left) + parseFloat(el.style.width)).toBeLessThan(
      window.innerWidth,
    );
  });

  // Fixed coordinates are measured once and then go stale: the marker moves
  // whenever its column scrolls, and an inner scroller's event does not bubble
  // to the window, so this listens in the capture phase.
  it("follows the marker when the column underneath it scrolls", () => {
    const view = renderNoteInAColumn();
    const el = open(view);
    const before = el.style.bottom;

    marker(view, { left: 400, right: 408, top: 200, bottom: 212 });
    scrollColumn(view);

    expect(panel()!.style.bottom).not.toBe(before);
  });

  // A fixed panel does not scroll away with the text it belongs to. Left
  // following a marker the column has already hidden, it would sit over the
  // page pointing at nothing, so it closes with the marker instead.
  it("closes when the column scrolls its marker out of sight", () => {
    const view = renderNoteInAColumn();
    open(view);
    scrollBoxSpans(view, { top: 100, bottom: 700 });

    marker(view, { left: 400, right: 408, top: 20, bottom: 32 });
    scrollColumn(view);

    expect(panel()).toBeNull();
  });

  // The same rule on the other axis: below the comfortable width the whole
  // column strip scrolls sideways (ADR-0019), which can carry a hovered
  // marker out past its edge while nothing about it moves vertically.
  it("closes when the strip scrolls its marker out sideways", () => {
    const view = renderNoteInAColumn();
    open(view);
    stripSpans(view, { left: 300, right: 900 });

    marker(view, { left: 40, right: 48, top: 500, bottom: 512 });
    fireEvent.scroll(strip(view));

    expect(panel()).toBeNull();
  });

  // ...and a marker the strip still shows keeps its panel, so the sideways
  // check cannot close a panel the vertical one would have left open.
  it("keeps the panel while the strip still shows the marker", () => {
    const view = renderNoteInAColumn();
    open(view);
    stripSpans(view, { left: 300, right: 900 });

    marker(view, { left: 320, right: 328, top: 500, bottom: 512 });
    fireEvent.scroll(strip(view));

    expect(panel()).not.toBeNull();
  });
});

describe("the panel can be read, entered and left", () => {
  it("lets the pointer cross the gap from the marker into the panel", () => {
    const view = renderNoteInAColumn();
    const el = open(view);

    fireEvent.mouseLeave(marker(view));
    fireEvent.mouseEnter(el);
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS * 4));

    expect(panel()).not.toBeNull();
  });

  it("closes shortly after the pointer leaves the panel itself", () => {
    const view = renderNoteInAColumn();
    const el = open(view);
    fireEvent.mouseEnter(el);

    fireEvent.mouseLeave(el);
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS));

    expect(panel()).toBeNull();
  });

  it("closes when the pointer leaves the marker for anywhere else", () => {
    const view = renderNoteInAColumn();
    open(view);

    fireEvent.mouseLeave(marker(view));
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS));

    expect(panel()).toBeNull();
  });

  it("stays open while the pointer is still on its way, not gone", () => {
    const view = renderNoteInAColumn();
    open(view);

    fireEvent.mouseLeave(marker(view));
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS / 2));

    expect(panel()).not.toBeNull();
  });

  // Selecting a note's last line means dragging past the panel's edge, and
  // copying from the context menu means leaving the panel altogether. Closing on
  // `mouseleave` alone would unmount the panel under the selection and take the
  // text with it, so the panel with text selected in it stays up.
  it("does not close out from under a selection the reader is still holding", () => {
    const view = renderNoteInAColumn("Fionn is Find.");
    const el = open(view);
    selectContentsOf(el);

    fireEvent.mouseLeave(el);
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS * 4));

    expect(panel()).not.toBeNull();
  });

  it("closes once that selection is let go", () => {
    const view = renderNoteInAColumn("Fionn is Find.");
    const el = open(view);
    selectContentsOf(el);
    fireEvent.mouseLeave(el);
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS * 2));

    window.getSelection()!.removeAllRanges();
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS * 2));

    expect(panel()).toBeNull();
  });

  it("takes the pointer rather than letting it through, so the text can be selected", () => {
    const view = renderNoteInAColumn();

    const el = open(view);

    expect(el.className).not.toContain("pointer-events-none");
    expect(el.className).toContain("select-text");
  });

  // Notes here run to 263 characters and some hold a `<p>`. A panel that is
  // taller than the room beside its marker scrolls inside its own box.
  it("scrolls a note that outgrows the room it was given", () => {
    const view = renderNoteInAColumn("x".repeat(263));

    const el = open(view);

    expect(el.className).toContain("overflow-y-auto");
    expect(parseFloat(el.style.maxHeight)).toBeGreaterThan(0);
  });

  it("stops its timer when the note unmounts mid-hover", () => {
    const view = renderNoteInAColumn();
    open(view);

    fireEvent.mouseLeave(marker(view));
    view.unmount();
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS * 4));

    expect(panel()).toBeNull();
  });
});

describe("the panel is light paper, and the marker is untouched", () => {
  it("is a warm paper surface with a hairline border, dark text and a shadow", () => {
    const view = renderNoteInAColumn();

    const { className } = open(view);

    expect(className).toContain("bg-[#FAF9F3]");
    expect(className).toContain("border-[#D8D4C3]");
    expect(className).toContain("text-[#52524F]");
    expect(className).toContain("shadow-lg");
    // The cold grey the panel used to be, in a warm parchment interface.
    expect(className).not.toContain("bg-gray-800");
    expect(className).not.toContain("text-white");
  });

  // ADR-0016's one exemption, carried into ADR-0018: the marker is the
  // affordance saying a note is there to open, and it keeps its number (#154).
  it("leaves the marker its number, colour and size", () => {
    const view = renderNoteInAColumn();
    const sup = view.container.querySelector("sup")!;

    expect(sup.textContent).toBe("3");
    expect(sup.className).toContain("text-blue-500");
    expect(sup.className).toContain("text-sm");
    expect(sup.className).toContain("leading-none");
  });
});

describe("select-to-search", () => {
  /**
   * Portalled to `body`, the panel is outside `[data-tei-content]`, which is
   * what `readTEISelection` scopes itself to. So selecting a note's text offers
   * nothing — and that is the right answer, not a gap: a note is the editor's
   * English commentary, and the search index dropped it on purpose (SKIP_TAGS).
   */
  it("is not offered for text selected inside the panel", () => {
    const view = renderNoteInAColumn("Fionn is Find.");

    selectContentsOf(open(view));

    expect(readTEISelection(window.getSelection())).toBeNull();
  });

  it("is still offered for the manuscript text around the marker", () => {
    const view = renderNoteInAColumn();

    selectContentsOf(view.container.querySelector("p")!);

    expect(readTEISelection(window.getSelection())).toMatchObject({
      docId: "doc-1",
    });
  });
});
