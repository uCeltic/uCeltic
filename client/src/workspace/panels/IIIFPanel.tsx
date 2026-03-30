export default function IIIFPanel() {
    return (
      <aside className="h-full bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">IIIF Viewer</h2>
          <p className="mt-1 text-xs text-gray-500">
            Linked manuscript images will be displayed here.
          </p>
        </div>

        <div className="flex h-[calc(100%-57px)] items-center justify-center p-4">
          <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50
   text-sm text-gray-500">
            IIIF image panel placeholder
          </div>
        </div>
      </aside>
    )
  }
