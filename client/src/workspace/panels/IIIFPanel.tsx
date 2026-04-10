import { useState, useEffect } from "react";

function pageApiUrl(page: number) {
  const p = String(page).padStart(3, "0");
  return `https://iiif.isos.dias.ie/iiif/2/UCC%2FUCC_TheBookOfLismore%2F${p}.tif/full/full/0/default.jpg`;
}
  const TOTAL_PAGES = 500;
  const INITIAL_PAGE = 325;

  export default function IIIFPanel() {
    const [page, setPage] = useState(INITIAL_PAGE);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let objectUrl: string;
      setLoading(true);
      fetch(pageApiUrl(page))
        .then((res) => res.blob())
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          setImgSrc(objectUrl);
          setLoading(false);
        });
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [page]);

    return (
      <aside className="flex h-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
          <span className="text-sm font-medium text-gray-700">Book of Lismore</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700
  hover:bg-gray-100"
            >
              ←
            </button>
            <span className="text-sm text-gray-600">{page}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}
              className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700
  hover:bg-gray-100"
            >
              →
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
            {imgSrc && (
              <img src={imgSrc} alt={`Page ${page}`} className="w-full" />
            )}
            {loading && (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                Loading...
              </div>
            )}
          </div>
      </aside>
    );
  }