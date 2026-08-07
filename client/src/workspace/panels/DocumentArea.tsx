import { useEffect, useRef, useState } from "react";
import {
  isSearchableDocument,
  useDocumentStore,
} from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { useTourStore } from "../../store/tourStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import TEIRenderer from "../../tei/TEIRenderer";
import TEIErrorBoundary from "../../tei/ErrorBoundary";
import type { TEIDoc } from "../../types/tei";
import type { SearchResult } from "../../types/search";
import { rangesForWordSpan } from "../../tei/wordRange";
import {
  entityOccurrences,
  rebuildEntityHighlights,
  rebuildHighlights,
} from "../../tei/highlight";
import { useEntityMenu } from "../../tei/useEntityMenu";
import { COLUMN_MIN_WIDTH_PX } from "../responsive";
// Drag to arrange the text viewers from @dnd-kit。
import {
  DndContext, //   All text viewers are managed here
  closestCenter, //  Calculate the position, When dragging, the position of this coloumn will be the closest to the center of the target coloumn
  PointerSensor, //  When cursor is on the file title, the cursor will be changed
  useSensor,
  useSensors,
  type DragEndEvent, //  When the user releases the drag, the event will be triggered
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy, //  The text viewers are arranged horizontally
  useSortable, //  Make the column draggable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities"; // dnd-kit transform object to CSS string
import SelectionSearchButton from "./SelectionSearchButton";
import { READING_ONLY_LABEL, READING_ONLY_TITLE } from "./localDocumentCopy";
import {
  computeDragEndReorder,
  dragReorderHintDismissedBefore,
  markDragReorderHintDismissed,
} from "./dragReorderHint";

// props for each text viewer column
interface SortableDocumentColumnProps {
  doc: ReturnType<
    typeof useDocumentStore.getState
  >["openDocuments"][number];
  index: number;
  totalCount: number;
  docResults: SearchResult[];
  isSearching: boolean;
  hasError: boolean;
  activeIndex: number;
  activeResult: SearchResult | undefined;
  showDragHint: boolean;
  entityCard: EntityCardState | null;
  onDismissDragHint: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEntityPrev: () => void;
  onEntityNext: () => void;
  onRetry: () => void;
  onClose: () => void;
}

// What this column has to say about the entity the Tag Filter is following:
// who they are, how often this manuscript names them, and which occurrence the
// column is sitting on. `null` when nothing is selected, or when the menu has
// nothing to say about this column's document.
interface EntityCardState {
  headword: string;
  count: number;
  index: number;
}

// One slim row: who is being followed, where this column is among their
// occurrences, and the two arrows that move within THIS column only. It sits
// alongside the search result card rather than replacing it, because a tag
// highlight and a search highlight are both allowed on screen at once.
function EntityNavCard({
  entity,
  onPrev,
  onNext,
}: {
  entity: EntityCardState;
  onPrev: () => void;
  onNext: () => void;
}) {
  const navBtn =
    "rounded-md border border-gray-300 bg-white px-2 py-0.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 disabled:cursor-default disabled:opacity-40";
  return (
    <div
      className="flex items-center justify-between gap-2 border-b border-gray-200 bg-[#F5F1DF] px-3 py-1"
    >
      <span className="min-w-0 truncate text-sm font-medium text-[#52524F]">
        {entity.headword}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs tabular-nums text-gray-500">
          {/* a manuscript that never names them says so, rather than showing
              "1 / 0" or vanishing and reading as a bug */}
          {entity.count === 0
            ? "none here"
            : `${entity.index + 1} / ${entity.count}`}
        </span>
        <button
          type="button"
          aria-label="Previous occurrence"
          disabled={entity.count === 0}
          onClick={onPrev}
          className={navBtn}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="Next occurrence"
          disabled={entity.count === 0}
          onClick={onNext}
          className={navBtn}
        >
          →
        </button>
      </div>
    </div>
  );
}

// A column whose document cannot be searched says so in its header, for as long
// as it is open. Not searchable is a property of the *Document* — true from the
// moment it opens, whether or not anyone ever runs a search — so it belongs
// beside the title and not to a search result card (#175). Olive, the same
// muted note colour the toolbar's secondary text uses: this is a standing fact
// about the column, not a warning about something that went wrong.
function ReadingOnlyChip() {
  return (
    // `min-w-0 truncate`: at the column's floor width the header has the 160px
    // title button and the ✕ to fit first, and both are `shrink-0` (#159) — so
    // the chip is what gives way, the way the result card's metadata does. It
    // carries the full sentence as a `title` for the same reason the title
    // button does: two words clipped to "Reading o…" would otherwise be the
    // only thing the column says about itself.
    <span
      title={READING_ONLY_TITLE}
      className="min-w-0 truncate rounded-md border border-[#D8D4C3] bg-[#F5F1DF] px-2 py-0.5 text-xs font-medium text-[#8A8778]"
    >
      {READING_ONLY_LABEL}
    </span>
  );
}

// One-time popover pointing at the grip icon, telling the user the title
// button is draggable. Rendered as a sibling of the draggable button (not a
// child) so its own pointer events never reach the button's drag listeners.
function DragReorderHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="absolute left-0 top-full z-50 mt-1.5 flex w-56 items-start gap-2 rounded-md border border-[#D8D4C3] bg-[#F5F1DF] px-3 py-2 text-xs text-[#52524F] shadow-lg"
    >
      <p className="flex-1">Drag to reorder columns</p>
      <button
        type="button"
        aria-label="Dismiss drag-reorder hint"
        onClick={onDismiss}
        className="shrink-0 rounded-md px-1 text-[#6B6B67] cursor-pointer transition-all hover:bg-[#E8E3CE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30"
      >
        ✕
      </button>
    </div>
  );
}

// Scroll a TEI column to a search result. Highlight painting is centralized in
// the rebuildHighlights effect, so this only scrolls — it never touches the CSS
// Highlight registry (doing so would wipe every other column's highlights).
function scrollToResult(docId: string, result: SearchResult, teiDoc: TEIDoc) {
  const columnEl = document.querySelector(`[data-doc-column-id="${docId}"]`); // get the text viewer column element
  if (!columnEl) return;

  // jump to the rendered anchor element
  if (result.anchor_id != null) {
    const scrollEl = columnEl.querySelector(
      `[data-tei-anchor-id="${result.anchor_id}"]`,
    );
    if (scrollEl) {
      scrollEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
  // backup plan: jump to the first range of the word span
  const ranges = rangesForWordSpan(
    columnEl,
    teiDoc.anchors,
    result.word_start,
    result.word_end,
  );
  if (ranges.length > 0) {
    const rect = ranges[0].getBoundingClientRect();
    window.scrollTo({
      top: rect.top + window.scrollY - window.innerHeight / 2,
      behavior: "smooth",
    });
  }
}

// Render a single text viewer column: top title bar, main content, and bottom search result panel.
function SortableDocumentColumn({
  doc,
  index,
  totalCount,
  docResults,
  isSearching,
  hasError,
  activeIndex,
  activeResult,
  showDragHint,
  entityCard,
  onDismissDragHint,
  onPrev,
  onNext,
  onEntityPrev,
  onEntityNext,
  onRetry,
  onClose,
}: SortableDocumentColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // The floor that keeps this column readable: `flex-1` still splits the area
    // evenly while every column fits, and stops shrinking here when they don't
    // — at which point the strip around them scrolls (ADR-0019).
    minWidth: COLUMN_MIN_WIDTH_PX,
  };
  const fontSize = useWorkspaceStore((state) => state.fontSize);
  // The same rule the search itself is built from, so this column can only ever
  // report on a search that was actually run against it (#175).
  const searchable = isSearchableDocument(doc);
  return (
    <article
      data-doc-column-id={doc.id}
      ref={setNodeRef}
      style={style}
      className={`flex flex-1 flex-col bg-[#f5f6ee] ${index < totalCount - 1 ? "border-r border-gray-200" : ""
        }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            <button
              type="button"
              title={doc.title}
              // What the tour's reorder step rings: the grip *is* the title
              // button, which is why the hint beside it exists at all (#178).
              data-tour="column-grip"
              {...attributes}
              {...listeners}
              className="flex w-[160px] cursor-grab items-center gap-1.5 truncate rounded-md border border-gray-200
bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 active:cursor-grabbing"
            >
              <span aria-hidden="true" className="shrink-0 text-gray-400">⋮⋮</span>
              <span className="truncate">{doc.title}</span>
            </button>
            {showDragHint && <DragReorderHint onDismiss={onDismissDragHint} />}
          </div>
          {!searchable && <ReadingOnlyChip />}
        </div>
        {/* shrink-0: the column has a floor of its own now, but the ✕ is what
            the header sacrifices first without one — it must keep its full hit
            area rather than sliding under the neighbouring column (#159). */}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md bg-[#FAF9F3] px-2.5 py-1.5 text-sm font-medium text-[#52524F]
          cursor-pointer transition-colors hover:bg-[#F0EEE6]"
        >
          ✕
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Result card — fixed below the header, and only for a column a search
            can reach. A Local Document is filtered out before the request is
            built, so every branch below would be an answer to a question this
            column was never asked: "No search results" reads as *we looked and
            your file does not contain it*. It gets no slot at all, the way a
            document with no Name Index gets no entity card (#164, #175); the
            header's chip is what says why, once, for as long as it is open. */}
        {searchable && (isSearching ? (
          <div className="border-b border-gray-200 px-3 py-2 text-xs text-gray-400">
            Searching…
          </div>
        ) : docResults.length > 0 ? (
          <div className="border-b border-gray-200 bg-gray-50" data-tour="result-card">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="shrink-0 text-sm font-medium text-gray-800">
                Result {activeIndex + 1} / {docResults.length}
              </div>
              {/* The one part of the row that gives way in a narrow column:
                  line and score are context, while the counter and the arrows
                  are what the card is for (#159). `truncate` sits on the two
                  spans, not on this flex container — `text-overflow` has no
                  effect on a box whose children are flex items — and it is what
                  lets them shrink at all, since `overflow: hidden` is what
                  drops a flex item's automatic min-width. */}
              <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
                <span className="truncate">
                  {activeResult?.line_no && <span>Line
                    {activeResult.line_no}</span>}
                </span>
                <span className="truncate">
                  Score:{" "}
                  {activeResult?.score !== undefined
                    ? activeResult.score.toFixed(2)
                    : "N/A"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1" data-tour="result-nav">
                <button
                  type="button"
                  onClick={onPrev}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700
  hover:bg-gray-100"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700
  hover:bg-gray-100"
                >
                  →
                </button>
              </div>
            </div>
            <div className="px-3 pb-2">
              <div
                className="max-h-24 overflow-auto rounded-lg border border-gray-200 bg-white p-2.5 text-sm
  leading-5 text-gray-700"
              >
                {activeResult?.snippet}
              </div>
            </div>
          </div>
        ) : hasError ? (
          // "retry" names an action, so it is a button that performs it: one
          // search of this column alone, replaying the attempt that failed.
          // The loading state renders above this branch, so a retry in flight
          // takes the button off screen — it cannot be fired twice.
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-xs text-red-500">
            <span>Search failed</span>
            <button
              type="button"
              aria-label={`Retry search in ${doc.title}`}
              onClick={onRetry}
              className="rounded-md border border-red-300 bg-white px-2 py-0.5 font-medium text-red-600
              cursor-pointer transition-colors hover:bg-red-50 focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-red-400/40"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="border-b border-gray-200 px-3 py-2 text-xs text-gray-400">
            No search results
          </div>
        ))}

        {entityCard && (
          <EntityNavCard
            entity={entityCard}
            onPrev={onEntityPrev}
            onNext={onEntityNext}
          />
        )}

        {/* document text content */}
        {/* data-tour: the tour's "select a passage" step rings this pane, and
            its gate counts a selection only if both ends land inside one (#178). */}
        <div className="min-h-0 flex-1 overflow-auto p-4" data-tour="column-text">
          {/* if the document is a TEI document, hand it to the TEIRenderer, let it render the tei document. */}
          {doc.format === "tei" ? (
            // data-tei-content marks the searchable rendered text: select-to-search
            // only offers itself for selections landing inside one of these.
            <div
              data-tei-content
              className="leading-6 text-gray-800"
              style={{ fontSize }}
            >
              <TEIErrorBoundary>
                <TEIRenderer node={(doc.content as TEIDoc).parsed_json} />
              </TEIErrorBoundary>
            </div>
          ) : (
            <pre
              className="whitespace-pre-wrap break-words leading-6 text-gray-800"
              style={{ fontSize }}
            >
              {doc.content as string}
            </pre>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * DocumentArea
 *
 * Render all open documents, allow the user to drag the title button to reorder columns.
 */
export default function DocumentArea() {
  const openDocuments = useDocumentStore((state) => state.openDocuments);
  const visibleDocumentIds = useDocumentStore(
    (state) => state.visibleDocumentIds,
  );
  const setVisibleDocumentIds = useDocumentStore(
    (state) => state.setVisibleDocumentIds,
  );

  const resultsByDocument = useSearchStore(
    (state) => state.resultsByDocument,
  );
  const activeResultIndexByDocument = useSearchStore(
    (state) => state.activeResultIndexByDocument,
  );

  const isSearchingByDocument = useSearchStore(
    (state) => state.isSearchingByDocument,
  );

  const searchErrorByDocument = useSearchStore(
    (state) => state.searchErrorByDocument,
  );

  const removeDocument = useDocumentStore(
    (state) => state.removeDocument,
  );

  const nextResult = useSearchStore((state) => state.nextResult);
  const prevResult = useSearchStore((state) => state.prevResult);
  const retrySearch = useSearchStore((state) => state.retrySearch);
  const clearDocumentResults = useSearchStore(
    (state) => state.clearDocumentResults,
  );

  const selectedEntityId = useWorkspaceStore((state) => state.selectedEntityId);
  const entityIndexByDocument = useWorkspaceStore(
    (state) => state.entityIndexByDocument,
  );
  const nextEntityOccurrence = useWorkspaceStore(
    (state) => state.nextEntityOccurrence,
  );
  const prevEntityOccurrence = useWorkspaceStore(
    (state) => state.prevEntityOccurrence,
  );

  const visibleDocuments = visibleDocumentIds
    .map((id) => openDocuments.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);

  // The very menu the toolbar offers, read here for its counts — so a column's
  // "1 / 12" and the menu's "12" can never disagree.
  const { entries, columnIndexById, columnsWithNameIndex } = useEntityMenu();
  const selectedEntity = entries.find((e) => e.id === selectedEntityId);

  // Which columns get a card, and it turns on the two silences CONTEXT.md →
  // Tag Filter keeps apart (#164): a column that groups its names and never
  // writes this one keeps its card, reading "none here", because *this witness
  // does not name Find* is one of the answers a side-by-side comparison comes
  // back with; a column whose document carries no `@nymRef` at all gets none,
  // because it was never asked. There is no fallback to matching by element
  // name, which is the behaviour #147 removes.
  function entityCardFor(docId: string): EntityCardState | null {
    const column = columnIndexById.get(docId);
    if (!selectedEntity || column === undefined) return null;
    if (!columnsWithNameIndex.has(docId)) return null;
    return {
      headword: selectedEntity.headword,
      // `?? 0` only ever fires if the menu's two per-column collections
      // disagree, and reads as "none here" if they ever do — never as a card
      // counting to `undefined`.
      count: selectedEntity.counts[column] ?? 0,
      index: entityIndexByDocument[docId] ?? 0,
    };
  }

  // Scroll a column to the occurrence it is now sitting on. The index is read
  // back out of the store rather than recomputed, so the clamping lives in one
  // place; the spans are already on screen — they are the rendered entity
  // elements — so this needs no anchor arithmetic, unlike a search result.
  function scrollToOccurrence(docId: string) {
    if (!selectedEntityId) return;
    const index =
      useWorkspaceStore.getState().entityIndexByDocument[docId] ?? 0;
    entityOccurrences(docId, selectedEntityId)[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  // Repaint the Tag Filter's highlights for every visible column together, for
  // the same reason the search highlights are repainted in one place: the
  // registry holds one Highlight per tier across all columns, so one column's
  // change must never be applied by editing that Highlight in place.
  useEffect(() => {
    rebuildEntityHighlights(
      visibleDocumentIds.map((id) => ({
        docId: id,
        entityId: selectedEntityId,
        activeIndex: entityIndexByDocument[id] ?? 0,
      })),
    );
  }, [
    visibleDocumentIds,
    openDocuments,
    selectedEntityId,
    entityIndexByDocument,
  ]);

  // Following a new person starts every column at its own first occurrence, the
  // way a new search scrolls each column to its own first result.
  useEffect(() => {
    if (!selectedEntityId) return;
    for (const id of visibleDocumentIds) {
      entityOccurrences(id, selectedEntityId)[0]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId]);

  // Repaint BOTH search highlights for every visible TEI column whenever the
  // results, active indices, or visible columns change. Navigation only updates
  // the store + scrolls, so painting lives here in one place — one column's
  // change can never wipe another column's highlights.
  useEffect(() => {
    const teiColumns = visibleDocumentIds
      .map((id) => openDocuments.find((d) => d.id === id))
      .filter(
        (d): d is NonNullable<typeof d> =>
          d !== undefined && d.format === "tei",
      )
      .map((d) => ({
        docId: d.id,
        teiDoc: d.content as TEIDoc,
        results: resultsByDocument[d.id] ?? [],
        activeIndex: activeResultIndexByDocument[d.id] ?? 0,
      }));
    rebuildHighlights(teiColumns);
  }, [
    visibleDocumentIds,
    openDocuments,
    resultsByDocument,
    activeResultIndexByDocument,
  ]);

  // Auto-scroll each column to its own first result once results arrive (reset
  // when its results are cleared, so the next search scrolls again).
  const scrolledDocsRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    visibleDocumentIds
      .map((id) => openDocuments.find((d) => d.id === id))
      .filter(
        (d): d is NonNullable<typeof d> =>
          d !== undefined && d.format === "tei",
      )
      .forEach((d) => {
        const results = resultsByDocument[d.id] ?? [];
        if (results.length > 0 && !scrolledDocsRef.current[d.id]) {
          scrolledDocsRef.current[d.id] = true;
          scrollToResult(d.id, results[0], d.content as TEIDoc);
        } else if (results.length === 0) {
          scrolledDocsRef.current[d.id] = false;
        }
      });
  }, [visibleDocumentIds, openDocuments, resultsByDocument]);

  const sensors = useSensors(useSensor(PointerSensor));

  // Discovery hint: show once, the first time a second column appears, on
  // that column's grip icon. Dismissed for good either via its ✕ or by the
  // user completing any drag-reorder, whichever comes first.
  //
  // Detecting the 1->2 transition happens during render (not an effect):
  // React's documented pattern for "adjusting state when a value changes"
  // is to compare against a bit of state carried from the previous render
  // and update it inline, which bails out before the DOM commits instead of
  // scheduling a second, effect-driven render.
  const [dragHintDismissed, setDragHintDismissed] = useState(
    dragReorderHintDismissedBefore,
  );
  // The tour teaches dragging itself, at its own step — five steps after the
  // second column appears. While it is running the hint would be teaching the
  // wrong thing at the wrong moment, so it stays out of the way; and the tour
  // records the dismissal once it has taught that step, which is what this
  // re-reads when the tour closes (#178).
  const tourOpen = useTourStore((s) => s.isOpen);
  useEffect(() => {
    if (!tourOpen) setDragHintDismissed(dragReorderHintDismissedBefore());
  }, [tourOpen]);
  const [dragHintDocId, setDragHintDocId] = useState<string | null>(null);
  const [prevVisibleCount, setPrevVisibleCount] = useState(
    visibleDocumentIds.length,
  );

  const showDragHintFor = tourOpen || dragHintDismissed ? null : dragHintDocId;

  if (visibleDocumentIds.length !== prevVisibleCount) {
    const newCount = visibleDocumentIds.length;
    if (prevVisibleCount === 1 && newCount === 2 && !dragHintDismissed) {
      setDragHintDocId(visibleDocumentIds[newCount - 1]);
    }
    setPrevVisibleCount(newCount);
  }

  function dismissDragHint() {
    markDragReorderHintDismissed();
    setDragHintDismissed(true);
    setDragHintDocId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const reordered = computeDragEndReorder(event, visibleDocumentIds);
    if (!reordered) return;
    setVisibleDocumentIds(reordered);
    dismissDragHint();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visibleDocumentIds}
        strategy={horizontalListSortingStrategy}
      >
        {/* The column strip. Columns hold COLUMN_MIN_WIDTH_PX and this scrolls
            sideways once they stop fitting, rather than every column collapsing
            past the point its own controls are usable (ADR-0019). Vertical
            overflow is pinned off: each column scrolls its own text, so the
            strip must not grow a second scrollbar around them — which is what
            `overflow-x: auto` alone would compute to. */}
        <section
          data-column-strip
          className="flex h-full min-h-0 overflow-x-auto overflow-y-hidden bg-[#f5f6ee]"
        >
          {visibleDocuments.map((doc, index) => {
            const docResults = resultsByDocument[doc.id] ?? [];
            const isSearching = isSearchingByDocument[doc.id] ?? false;
            const activeIndex =
              activeResultIndexByDocument[doc.id] ?? 0;
            const activeResult = docResults[activeIndex];

            return (
              <SortableDocumentColumn
                key={doc.id}
                doc={doc}
                index={index}
                totalCount={visibleDocuments.length}
                docResults={docResults}
                isSearching={isSearching}
                hasError={searchErrorByDocument[doc.id] ?? false}
                activeIndex={activeIndex}
                activeResult={activeResult}
                showDragHint={doc.id === showDragHintFor}
                entityCard={entityCardFor(doc.id)}
                onDismissDragHint={dismissDragHint}
                onEntityPrev={() => {
                  prevEntityOccurrence(doc.id);
                  scrollToOccurrence(doc.id);
                }}
                onEntityNext={() => {
                  nextEntityOccurrence(doc.id, entityCardFor(doc.id)?.count ?? 0);
                  scrollToOccurrence(doc.id);
                }}
                onPrev={() => {
                  const next = activeIndex > 0 ? activeIndex - 1 : activeIndex;
                  prevResult(doc.id);
                  const r = docResults[next];
                  if (r && doc.format === "tei") scrollToResult(doc.id, r, doc.content as TEIDoc);
                }}
                onNext={() => {
                  const next =
                    activeIndex < docResults.length - 1
                      ? activeIndex + 1
                      : activeIndex;
                  nextResult(doc.id);
                  const r = docResults[next];
                  if (r && doc.format === "tei") scrollToResult(doc.id, r, doc.content as TEIDoc);
                }}
                onRetry={() => retrySearch(doc.id)}
                onClose={() => {
                  if (window.confirm(`Close "${doc.title}"?`)) {
                    // A TEI column's id is derived from the document it shows,
                    // so reopening that document lands on the same id. Leaving
                    // this column's search state behind would hand the next one
                    // a failure — and a Retry — belonging to a closed column.
                    clearDocumentResults(doc.id);
                    removeDocument(doc.id);
                  }
                }}
              />
            );
          })}
        </section>
        {/* One trigger for the whole workspace — the pending selection is global,
            not per column, so it lives outside the column list. */}
        <SelectionSearchButton />
      </SortableContext>
    </DndContext>
  );
}
