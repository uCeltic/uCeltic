import { useManuscriptStore } from "../../store/manuscriptStore";

export default function ManuscriptArea() {
  const openManuscripts = useManuscriptStore(
    (state) => state.openManuscripts,
  );
  const visibleManuscriptIds = useManuscriptStore(
    (state) => state.visibleManuscriptIds,
  );
  const visibleManuscripts = openManuscripts.filter((manuscript) =>
    visibleManuscriptIds.includes(manuscript.id),
  );

  return (
    <section className="flex h-full min-h-0 bg-gray-50">
      {visibleManuscripts.map((manuscript, index) => (
        <article
          key={manuscript.id}
          className={`flex min-w-0 flex-1 flex-col bg-white ${
            index < visibleManuscripts.length - 1 ? "border-r border-gray-200" : ""
          }`}
        >
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700
  hover:bg-gray-100"
            >
              {manuscript.title} ▾
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
              Text viewer placeholder for {manuscript.title}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
