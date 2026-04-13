import { useRef, useState, useEffect } from "react";
import { useSearchStore } from "../../store/searchStore";

export default function AdvancedSearchPopover() {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const matchLength = useSearchStore((s) => s.matchLength);
  const precision = useSearchStore((s) => s.precision);
  const dissimilarityScore = useSearchStore((s) => s.dissimilarityScore);
  const topK = useSearchStore((s) => s.topK);
  const setMatchLength = useSearchStore((s) => s.setMatchLength);
  const setPrecision = useSearchStore((s) => s.setPrecision);
  const setDissimilarityScore = useSearchStore((s) => s.setDissimilarityScore);
  const setTopK = useSearchStore((s) => s.setTopK);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md px-2.5 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
          open
            ? "bg-[#E8E6DE] text-[#3a3a37]"
            : "bg-[#FAF9F3] text-[#52524F] hover:bg-[#F0EEE6]"
        }`}
      >
        Advanced
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4
shadow-lg"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Search Parameters
          </p>

          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm text-gray-700">
                <span>Match Length</span>
                <span>{matchLength}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={300}
                step={1}
                value={matchLength}
                onChange={(e) => setMatchLength(Number(e.target.value))}
                className="w-full accent-gray-700"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-sm text-gray-700">
                <span>Precision</span>
                <span>{precision}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={precision}
                onChange={(e) => setPrecision(Number(e.target.value))}
                className="w-full accent-gray-700"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-sm text-gray-700">
                <span>Dissimilarity Score</span>
                <span>{dissimilarityScore.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={dissimilarityScore}
                onChange={(e) => setDissimilarityScore(Number(e.target.value))}
                className="w-full accent-gray-700"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-sm text-gray-700">
                <span>Top K Results</span>
                <span>{topK}</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full accent-gray-700"
              />
            </div>

            <div className="mt-4 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Reset all parameters to default values?")) {
                    setMatchLength(120);
                    setPrecision(1);
                    setDissimilarityScore(0.5);
                    setTopK(6);
                  }
                }}
                className="w-full rounded-md bg-gray-100 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200
  cursor-pointer transition-colors"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
