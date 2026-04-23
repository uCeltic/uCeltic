import { useManuscriptStore } from "../../store/manuscriptStore";
import { useSearchStore } from "../../store/searchStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useEffect } from "react";
import TEIRenderer from "../../tei/TEIRenderer";
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
  // SortableContext = items={visibleManuscriptIds} + strategy={horizontalListSortingStrategy}+ order of the items
  SortableContext,
  horizontalListSortingStrategy, //  The ms text viewers are arranged horizontally
  useSortable, //  Make the column draggable
  arrayMove, // utility function: Update the index of the item
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities"; // dnd-kit transform object to CSS string

// props for each ms text viewer
// Get type from the useManuscriptStore
interface SortableColumnProps {
  manuscript: ReturnType<
    typeof useManuscriptStore.getState
  >["openManuscripts"][number];
  index: number; // The position of the ms text viewer
  totalCount: number; // total number of ms text viewers, to determine if the last column should have a right border
  manuscriptResults: ReturnType<
    typeof useSearchStore.getState
  >["resultsByManuscript"][string];
  activeIndex: number; // index of the search result
  activeResult: // search result object
    | ReturnType<
        typeof useSearchStore.getState
      >["resultsByManuscript"][string][number]
    | undefined;
  onPrev: () => void; // When the user clicks ←, switch to the previous result
  onNext: () => void; // When the user clicks →, switch to the next result
  onClose: () => void; // When the user clicks the close button, close the text viewer
}

// Render a single manuscript text viewer: top title bar, main content, and bottom search result panel.
// It is a standalone component because useSortable must be called inside each draggable item.
function SortableManuscriptColumn({
  manuscript,
  index,
  totalCount,
  manuscriptResults,
  activeIndex,
  activeResult,
  onPrev,
  onNext,
  onClose,
}: SortableColumnProps) {
  // useSortable register the ms text viewer "A" to dnd-kit, and return everything needed to make it draggable.
  // - setNodeRef：      tell dnd-kit this DOM is column "A"
  // - attributes/listeners：only the title button is draggable, not the whole column
  // - transform/transition：dragging animation
  // - isDragging：      true when the column is being dragged
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: manuscript.id });

  const style = {
    transform: CSS.Transform.toString(transform), // moving animation
    transition, // set position
    opacity: isDragging ? 0.5 : 1,
  };
  const fontSize = useWorkspaceStore((state) => state.fontSize);
  return (
    // add a right border as a separator between columns; except the last column
    <article
      ref={setNodeRef}
      style={style}
      className={`flex min-w-0 flex-1 flex-col bg-[#f5f6ee] ${
        index < totalCount - 1 ? "border-r border-gray-200" : ""
      }`}
    >
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-1">
        {/* drag is triggered when the user clicks the title
            add aria attributes to the button/ Accessibility friendly
            listen to the click event of the button */}
        <button
          type="button"
          title={manuscript.title}
          {...attributes}
          {...listeners}
          className="w-[160px] cursor-grab truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm
font-medium text-gray-700 hover:bg-gray-100 active:cursor-grabbing"
        >
          {manuscript.title} ▾
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
        {manuscriptResults.length > 0 ? (
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="text-sm font-medium text-gray-800">
                Result {activeIndex + 1} / {manuscriptResults.length}
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

        {/* ms text content */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {manuscript.format === "tei" ? (
            <div className="leading-6 text-gray-800" style={{ fontSize }}>
              <TEIRenderer node={(manuscript.content as TEIDoc).parsed_json} />
            </div>
          ) : (
            <pre
              className="whitespace-pre-wrap break-words leading-6 text-gray-800"
              style={{ fontSize }}
            >
              {manuscript.content as string}
            </pre>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * ManuscriptArea
 *
 * Render all manuscripts, and allow the user to drag the title button to adjust the order of the columns.
 */
export default function ManuscriptArea() {
  // all manuscripts that the user has opened (including title, content, id, etc.)
  const openManuscripts = useManuscriptStore((state) => state.openManuscripts);
  //  Save and update the order of ms text viewers by ms ids
  const visibleManuscriptIds = useManuscriptStore(
    (state) => state.visibleManuscriptIds,
  );

  const setVisibleManuscriptIds = useManuscriptStore(
    (state) => state.setVisibleManuscriptIds,
  );

  // search results by ms id, e.g. { "ms-1": [result, result, ...], ... }
  const resultsByManuscript = useSearchStore(
    (state) => state.resultsByManuscript,
  );
  // index of the active result by ms id, e.g. { "ms-1": 0, "ms-2": 1, ... }
  const activeResultIndexByManuscript = useSearchStore(
    (state) => state.activeResultIndexByManuscript,
  );

  const removeManuscript = useManuscriptStore(
    (state) => state.removeManuscript,
  );

  const nextResult = useSearchStore((state) => state.nextResult);
  const prevResult = useSearchStore((state) => state.prevResult);

  // create an array of ms in the order of visibleManuscriptIds
  // iterate visibleManuscriptIds, so the order is completely controlled by the id array.
  // filter out undefined, to avoid the case where the ms id exists but the ms data is not loaded yet.
  const visibleManuscripts = visibleManuscriptIds
    .map((id) => openManuscripts.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined);

  const mockResults = [
    {
      id: "r1",
      manuscriptId: "",
      lineStart: 12,
      lineEnd: 18,
      score: 0.87,
      content:
        "Ocus ba hé sin ingen ríg Gréc, \
  ocus ba hí ba dech cruth ocus delb...",
    },
    {
      id: "r2",
      manuscriptId: "",
      lineStart: 45,
      lineEnd: 51,
      score: 0.72,
      content:
        "Is and sin ro ráid Cú Chulainn: \
   Ní thó, ol sé, cid mór do chlú...",
    },
    {
      id: "r3",
      manuscriptId: "",
      lineStart: 88,
      lineEnd: 93,
      score: 0.61,
      content:
        "Batar immorro secht catha la \
  Coin Culainn i nÓenach Emna...",
    },
  ];

  const setResultsByManuscript = useSearchStore(
    (state) => state.setResultsByManuscript,
  );
  useEffect(() => {
    if (visibleManuscripts.length === 0) return;
    const mock: Record<string, typeof mockResults> = {};
    visibleManuscripts.forEach((m) => {
      if (!resultsByManuscript[m.id]) {
        mock[m.id] = mockResults.map((r) => ({ ...r, manuscriptId: m.id }));
      }
    });
    if (Object.keys(mock).length > 0) {
      setResultsByManuscript({ ...resultsByManuscript, ...mock });
    }
  }, [visibleManuscripts.length]);
  // register mouse/touch sensor, dnd-kit listens to the start of the drag
  const sensors = useSensors(useSensor(PointerSensor));

  // When the user releases the drag, the event will be triggered.
  // arrayMove returns a new array with the target item moved to the new index.
  // save to store and React will re-render, the order of the columns will be updated.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    // active is the ms viewer that is being dragged, over is the ms viewer that the dragged ms viewer is over

    // 1, over is null means the ms is being dragged to an invalid area; 2, id is the same means the position has not changed
    // in both cases, the order of the columns does not need to be updated
    if (!over || active.id === over.id) return;
    const oldIndex = visibleManuscriptIds.indexOf(active.id as string);
    const newIndex = visibleManuscriptIds.indexOf(over.id as string);
    setVisibleManuscriptIds(
      arrayMove(visibleManuscriptIds, oldIndex, newIndex),
    );
  }

  return (
    // DndContext enable dragging for all ms text viewers
    // collisionDetection determines which ms text viewer the dragged ms should fall into (the closest column to the center of the target column)
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {/* SortableContext share the current id order with each useSortable column.
          the id in useSortable({ id }) must be found in the items list. */}
      <SortableContext
        items={visibleManuscriptIds}
        strategy={horizontalListSortingStrategy}
      >
        <section className="flex h-full min-h-0 bg-[#f5f6ee]">
          {visibleManuscripts.map((manuscript, index) => {
            const manuscriptResults =
              resultsByManuscript[manuscript.id] ??
              mockResults.map((r) => ({ ...r, manuscriptId: manuscript.id }));
            const activeIndex =
              activeResultIndexByManuscript[manuscript.id] ?? 0;
            const activeResult = manuscriptResults[activeIndex];

            return (
              <SortableManuscriptColumn
                key={manuscript.id}
                manuscript={manuscript}
                index={index}
                totalCount={visibleManuscripts.length}
                manuscriptResults={manuscriptResults}
                activeIndex={activeIndex}
                activeResult={activeResult}
                onPrev={() => prevResult(manuscript.id)}
                onNext={() => nextResult(manuscript.id)}
                onClose={() => {
                  if (window.confirm(`Close "${manuscript.title}"?`)) {
                    removeManuscript(manuscript.id);
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
