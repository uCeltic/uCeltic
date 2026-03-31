export default function ToolBar() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-0.5">
      
      
      {/* Add Manuscript button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-gray-900 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Add Manuscript
        </button>
      </div>



      {/* Search input and buttons */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <input
          type="text"
          placeholder="Search manuscripts..."
          className="w-full max-w-lg rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
  outline-none ring-0 placeholder:text-gray-400 focus:border-gray-500"
        />

        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700
  hover:bg-gray-50"
        >
          Search
        </button>

        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700
  hover:bg-gray-50"
        >
          Advanced
        </button>
      </div>


      {/* Toggle IIIF button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700
  hover:bg-gray-50"
        >
          Toggle IIIF
        </button>
      </div>
    </header>
  );
}
