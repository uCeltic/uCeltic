export default function Sidebar() {
  return (
    <aside className="h-full border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Sidebar</h2>
            <p className="mt-1 text-xs text-gray-500">
                    Filters, upload controls, and search settings will live here.
            </p>

        </div>

        <div className="space-y-4 p-4">
            <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <h3 className="text-sm font-medium text-gray-800">Documents</h3>
                    <p className="mt-1 text-xs text-gray-500">
                        Uploaded manuscript list placeholder
                    </p>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <h3 className="text-sm font-medium text-gray-800">Search Controls</h3>
                    <p className="mt-1 text-xs text-gray-500">
                        Search options placeholder
                    </p>
            </section>
        </div>
    </aside>
  )
}