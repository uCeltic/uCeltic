import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useEffect } from "react";
import TEIRenderer from "../../tei/TEIRenderer";
import TEIErrorBoundary from "../../tei/ErrorBoundary";
import type { TEIDoc } from "../../types/tei";
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
  arrayMove, // utility function: Update the index of the item
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities"; // dnd-kit transform object to CSS string

// props for each text viewer column
interface SortableDocumentColumnProps {
  doc: ReturnType<
    typeof useDocumentStore.getState
  >["openDocuments"][number];
  index: number;
  totalCount: number;
  docResults: ReturnType<
    typeof useSearchStore.getState
  >["resultsByDocument"][string];
  activeIndex: number;
  activeResult:
    | ReturnType<
        typeof useSearchStore.getState
      >["resultsByDocument"][string][number]
    | undefined;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

// Render a single text viewer column: top title bar, main content, and bottom search result panel.
function SortableDocumentColumn({
  doc,
  index,
  totalCount,
  docResults,
  activeIndex,
  activeResult,
  onPrev,
  onNext,
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
      ref={setNodeRef}
      style={style}
      className={`flex min-w-0 flex-1 flex-col bg-[#f5f6ee] ${
        index < totalCount - 1 ? "border-r border-gray-200" : ""
      }`}
    >
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-1">
        <button
          type="button"
          title={doc.title}
          {...attributes}
          {...listeners}
          className="w-[160px] cursor-grab truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm
font-medium text-gray-700 hover:bg-gray-100 active:cursor-grabbing"
        >
          {doc.title} ▾
        </button>
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
        {docResults.length > 0 ? (
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="text-sm font-medium text-gray-800">
                Result {activeIndex + 1} / {docResults.length}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  Lines {activeResult?.lineStart}–{activeResult?.lineEnd}
                </span>
                <span>
                  Score:{" "}
                  {activeResult?.score !== undefined
                    ? activeResult.score.toFixed(2)
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700
  hover:bg-gray-100"
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
                {activeResult?.content}
              </div>
            </div>
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
            <div className="leading-6 text-gray-800" style={{ fontSize }}>
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

  const removeDocument = useDocumentStore(
    (state) => state.removeDocument,
  );

  const nextResult = useSearchStore((state) => state.nextResult);
  const prevResult = useSearchStore((state) => state.prevResult);

  const visibleDocuments = visibleDocumentIds
    .map((id) => openDocuments.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);

  const mockResults = [
    {
      id: "r1",
      documentId: "",
      lineStart: 12,
      lineEnd: 18,
      score: 0.87,
      content:
        "Ocus ba hé sin ingen ríg Gréc, \
  ocus ba hí ba dech cruth ocus delb...",
    },
    {
      id: "r2",
      documentId: "",
      lineStart: 45,
      lineEnd: 51,
      score: 0.72,
      content:
        "Is and sin ro ráid Cú Chulainn: \
   Ní thó, ol sé, cid mór do chlú...",
    },
    {
      id: "r3",
      documentId: "",
      lineStart: 88,
      lineEnd: 93,
      score: 0.61,
      content:
        "Batar immorro secht catha la \
  Coin Culainn i nÓenach Emna...",
    },
  ];

  const setResultsByDocument = useSearchStore(
    (state) => state.setResultsByDocument,
  );
  useEffect(() => {
    if (visibleDocuments.length === 0) return;
    const mock: Record<string, typeof mockResults> = {};
    visibleDocuments.forEach((d) => {
      if (!resultsByDocument[d.id]) {
        mock[d.id] = mockResults.map((r) => ({ ...r, documentId: d.id }));
      }
    });
    if (Object.keys(mock).length > 0) {
      setResultsByDocument({ ...resultsByDocument, ...mock });
    }
  }, [visibleDocuments.length]);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleDocumentIds.indexOf(active.id as string);
    const newIndex = visibleDocumentIds.indexOf(over.id as string);
    setVisibleDocumentIds(
      arrayMove(visibleDocumentIds, oldIndex, newIndex),
    );
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
            const docResults =
              resultsByDocument[doc.id] ??
              mockResults.map((r) => ({ ...r, documentId: doc.id }));
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
                activeIndex={activeIndex}
                activeResult={activeResult}
                onPrev={() => prevResult(doc.id)}
                onNext={() => nextResult(doc.id)}
                onClose={() => {
                  if (window.confirm(`Close "${doc.title}"?`)) {
                    removeDocument(doc.id);
                  }
                }}
              />
            );
          })}
        </section>
      </SortableContext>
    </DndContext>
  );
}
