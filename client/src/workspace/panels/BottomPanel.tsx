const results = [
    { id: 'r1', label: 'Search result 1', detail: 'Matched lines 120–145' },
    { id: 'r2', label: 'Search result 2', detail: 'Matched lines 300–318' },
    { id: 'r3', label: 'Search result 3', detail: 'Matched lines 980–1004' },
  ]

  export default function BottomPanel() {
    return (
      <section className="h-full bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Results Panel</h2>
          <p className="mt-1 text-xs text-gray-500">
            Recent search results and saved matches will appear here.
          </p>
        </div>

        <div className="h-[calc(100%-57px)] overflow-auto p-4">
          <div className="space-y-3">
            {results.map((result) => (
              <article
                key={result.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <h3 className="text-sm font-medium text-gray-800">{result.label}</h3>
                <p className="mt-1 text-xs text-gray-500">{result.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }
