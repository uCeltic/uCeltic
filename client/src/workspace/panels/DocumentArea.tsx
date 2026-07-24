import { useEffect, useRef, useState } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import TEIRenderer from "../../tei/TEIRenderer";
import TEIErrorBoundary from "../../tei/ErrorBoundary";
import type { TEIDoc } from "../../types/tei";
import type { SearchResult } from "../../types/search";
import { buildAnchorsById, buildWordToAnchor, buildRangesForWordSpan } from "../../tei/wordRange";
import { rebuildHighlights } from "../../tei/highlight";
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
  onDismissDragHint: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRetry: () => void;
  onClose: () => void;
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
  const anchorsById = buildAnchorsById(teiDoc.anchors);
  const wordToAnchor = buildWordToAnchor(teiDoc.word_array);
  const ranges = buildRangesForWordSpan(
    columnEl,
    anchorsById,
    wordToAnchor,
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
  onDismissDragHint,
  onPrev,
  onNext,
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
  };
  const fontSize = useWorkspaceStore((state) => state.fontSize);
  return (
    <article
      data-doc-column-id={doc.id}
      ref={setNodeRef}
      style={style}
      className={`flex min-w-0 flex-1 flex-col bg-[#f5f6ee] ${index < totalCount - 1 ? "border-r border-gray-200" : ""
        }`}
    >
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-1">
        <div className="relative">
          <button
            type="button"
            title={doc.title}
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
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-[#FAF9F3] px-2.5 py-1.5 text-sm font-medium text-[#52524F]
          cursor-pointer transition-colors hover:bg-[#F0EEE6]"
        >
          ✕
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* result card — fixed below header */}
        {isSearching ? (
          <div className="border-b border-gray-200 px-3 py-2 text-xs text-gray-400">
            Searching…
          </div>
        ) : docResults.length > 0 ? (
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="text-sm font-medium text-gray-800">
                Result {activeIndex + 1} / {docResults.length}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  {activeResult?.line_no && <span>Line
                    {activeResult.line_no}</span>}
                </span>
                <span>
                  Score:{" "}
                  {activeResult?.score !== undefined
                    ? activeResult.score.toFixed(2)
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-1" data-tour="result-nav">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  onClick={() => activeResult && doc.format === "tei" && scrollToResult(doc.id, activeResult, doc.content as TEIDoc)}
                >
                  Jump
                </button>
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
        )}

        {/* document text content */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
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

  const visibleDocuments = visibleDocumentIds
    .map((id) => openDocuments.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);

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
  const [dragHintDocId, setDragHintDocId] = useState<string | null>(null);
  const [prevVisibleCount, setPrevVisibleCount] = useState(
    visibleDocumentIds.length,
  );

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
        <section className="flex h-full min-h-0 bg-[#f5f6ee]">
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
                showDragHint={doc.id === dragHintDocId}
                onDismissDragHint={dismissDragHint}
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
