import { useManuscriptStore } from "../../store/manuscriptStore";
import { useSearchStore } from "../../store/searchStore";

export default function ManuscriptArea() {
  const openManuscripts = useManuscriptStore((state) => state.openManuscripts);

  const visibleManuscriptIds = useManuscriptStore(
    (state) => state.visibleManuscriptIds,
  );

  const resultsByManuscript = useSearchStore(
    (state) => state.resultsByManuscript,
  );

  const activeResultIndexByManuscript = useSearchStore(
    (state) => state.activeResultIndexByManuscript,
  );

  const nextResult = useSearchStore((state) => state.nextResult);
  const prevResult = useSearchStore((state) => state.prevResult);

  const visibleManuscripts = openManuscripts.filter((manuscript) =>
    visibleManuscriptIds.includes(manuscript.id),
  );

  return (
    <section className="flex h-full min-h-0 bg-gray-50">
      {visibleManuscripts.map((manuscript, index) => {
        const manuscriptResults = resultsByManuscript[manuscript.id] ?? [];
        const activeIndex = activeResultIndexByManuscript[manuscript.id] ?? 0;
        const activeResult = manuscriptResults[activeIndex];

        return (
          <article
            key={manuscript.id}
            className={`flex min-w-0 flex-1 flex-col bg-white ${
              index < visibleManuscripts.length - 1
                ? "border-r border-gray-200"
                : ""
            }`}
          >
            <header className="flex items-center justify-between border-b border-gray-200 px-4 py-1">
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium
text-gray-700 hover:bg-gray-100"
              >
                {manuscript.title} ▾
              </button>
            </header>

            {/* Manuscript content container */}
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Text viewer placeholder */}
              <div className="min-h-0 flex-1 overflow-auto p-4">
              <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
    {manuscript.content}
  </pre>
              </div>

              {/* Search results container */}
              {manuscriptResults.length > 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                    <div className="text-sm font-medium text-gray-800">
                      Result {activeIndex + 1} / {manuscriptResults.length}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Lines {activeResult.lineStart}–{activeResult.lineEnd}
                      </span>
                      <span>
                        Score:{" "}
                        {activeResult.score !== undefined
                          ? activeResult.score.toFixed(2)
                          : "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Jump
                      </button>
                      <button
                        type="button"
                        onClick={() => prevResult(manuscript.id)}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => nextResult(manuscript.id)}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 p-3">
                    <div
                      className="max-h-28 overflow-auto rounded-lg border border-gray-200 bg-white p-2.5
  text-sm leading-5 text-gray-700"
                    >
                      {activeResult.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No search results for {manuscript.title}.
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
