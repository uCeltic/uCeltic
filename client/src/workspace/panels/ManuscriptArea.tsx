import { useManuscriptStore } from "../../store/manuscriptStore";

const mockResults = [
  {
    id: "r1",
    lineRange: "Lines 300–318",
    score: "0.87",
    content:
      "Full result content for this manuscript appears here. This area should preserve the full text rather than truncating it with ellipsis. If the result content becomes long, the card body itself can scroll internally without, breaking the overall workspace layout.",
  },
  {
    id: "r2",
    lineRange: "Lines 512–536",
    score: "0.81",
    content:
      "Another full result content example. In the future, each manuscript column will have its own active result and its own result navigation state.",
  },
];

export default function ManuscriptArea() {
  const openManuscripts = useManuscriptStore((state) => state.openManuscripts);
  const visibleManuscriptIds = useManuscriptStore(
    (state) => state.visibleManuscriptIds,
  );

  const visibleManuscripts = openManuscripts.filter((manuscript) =>
    visibleManuscriptIds.includes(manuscript.id),
  );

  return (
    <section className="flex h-full min-h-0 bg-gray-50">
      {/* Manuscript article */}
      {visibleManuscripts.map((manuscript, index) => (
        <article
          key={manuscript.id}
          className={`flex min-w-0 flex-1 flex-col bg-white ${
            index < visibleManuscripts.length - 1
              ? "border-r border-gray-200"
              : ""
          }`}
        >
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-0.5">
            {/* Manuscript title button */}
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700
hover:bg-gray-100"
            >
              {manuscript.title} ▾
            </button>
          </header>

          {/* Manuscript content container */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Text viewer placeholder */}
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                {/* Text viewer placeholder for {manuscript.title} */}
              </div>
            </div>

            {/* Search results container */}

            <div className="rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                {/* Result navigation buttons */}
                <div className="text-sm font-medium text-gray-800">
                  Result 1 / {mockResults.length}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{mockResults[0].lineRange}</span>
                  <span>•</span>
                  <span>Score: {mockResults[0].score}</span>
                </div>


                {/* Jump to text button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium
text-gray-700 hover:bg-gray-100"
                  >
                    Jump
                  </button>
                </div>

                {/* Result prev and next buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700
hover:bg-gray-100"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700
hover:bg-gray-100"
                  >
                    →
                  </button>
                </div>
              </div>

                {/* Result content */}
                <div
                  className="max-h-40 overflow-auto rounded-lg border border-gray-200 bg-white p-3 text-sm
leading-6 text-gray-700"
                >
                  {mockResults[0].content}
                </div>

            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
