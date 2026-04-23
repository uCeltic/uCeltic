import { useEffect, useRef, useState } from "react";
import { listTEIDocs, fetchTEIDoc } from "../../api/tei";
import { useManuscriptStore, MAX_OPEN_MANUSCRIPTS } from "../../store/manuscriptStore";
import type { TEICatalogEntry } from "../../types/tei";


export default function TEIPickerDropdown() {
    const [open, setOpen] = useState(false);
    const [docs, setDocs] = useState<TEICatalogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const addTEIManuscript = useManuscriptStore((s) => s.addTEIManuscript);
    const openManuscripts = useManuscriptStore((s) => s.openManuscripts);

    useEffect(() => {
      function handleClickOutside(e: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      if (open) document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    async function handleOpen() {
      setOpen((v) => !v);
      if (docs.length === 0) {
        setLoading(true);
        try {
          const list = await listTEIDocs();
          setDocs(list);
        } finally {
          setLoading(false);
        }
      }
    }

    async function handleSelect(entry: TEICatalogEntry) {
      if (openManuscripts.length >= MAX_OPEN_MANUSCRIPTS) {
        alert("Maximum 8 documents allowed.");
        return;
      }
      const doc = await fetchTEIDoc(entry.id);
      addTEIManuscript(doc);
      setOpen(false);
    }


    return (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-md border border-[#E5E2D6] bg-white px-2.5 py-1.5 text-sm font-medium text-[#52524F]
    cursor-pointer transition-all hover:bg-[#F0EEE6]"
          >
            Open TEI
          </button>
  
          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white
    shadow-lg">
              {loading ? (
                <p className="px-4 py-3 text-sm text-gray-400">Loading...</p>
              ) : docs.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No documents found.</p>
              ) : (
                <ul>
                  {docs.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(doc)}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <div className="font-medium truncate">{doc.title}</div>
                        <div className="text-xs text-gray-400">{doc.language || "unknown language"}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      );
    }
  