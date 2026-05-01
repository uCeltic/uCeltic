import { useEffect, useRef, useState } from "react";
import { listTEIDocs, fetchTEIDoc } from "../../api/tei";
import {
  useDocumentStore,
  MAX_OPEN_DOCUMENTS,
} from "../../store/documentStore";
import type { TEICatalogEntry } from "../../types/tei";

// Dropdown panel for opening TEI documents from the catalog.
//
// User flow:
// 1. The user clicks "Open TEI".
// 2. The dropdown opens and, on the first open, asks the backend for the catalog list.
// 3. The user selects one catalog entry.
// 4. The full TEI document is fetched and added to workspace.
export default function TEIPickerDropdown() {
  // the dropdown menu is currently visible.
  const [open, setOpen] = useState(false);

  // Stores the  entries shown in the dropdown.
  const [docs, setDocs] = useState<TEICatalogEntry[]>([]);

  // Shows  "Loading..." message while fetching
  const [loading, setLoading] = useState(false);

  // if the user clicks outside the dropdown, the menu will close.
  const dropdownRef = useRef<HTMLDivElement>(null);

  // add the selected document to the workspace.

  const addTEIDocument = useDocumentStore((s) => s.addTEIDocument);
  const openDocuments = useDocumentStore((s) => s.openDocuments);

  // if the user clicks outside the dropdown, the menu will close.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    // Only listen for outside clicks while the dropdown is open.
    // The cleanup removes the listener when it closes or when the component unmounts.
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleOpen() {
    // open the dropdown menu first, don't wait for the catalog to be fetched.
    setOpen((v) => !v);

    // Lazy-load the catalog: the backend is called only the first time the user
    // opens this dropdown. After that, the existing docs array is reused.
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
    // max 8 documents allowed.
    if (openDocuments.length >= MAX_OPEN_DOCUMENTS) {
      alert("Maximum 8 documents allowed.");
      return;
    }

    // The dropdown only has catalog metadata. Fetch the complete TEI document
    // Then put it into document store.
    const doc = await fetchTEIDoc(entry.id);
    addTEIDocument(doc);
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
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white
    shadow-lg"
        >
          {loading ? (
            <p className="px-4 py-3 text-sm text-gray-400">Loading...</p>
          ) : docs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">
              No documents found.
            </p>
          ) : (
            <ul>
              {docs.map((doc) => (
                <li key={doc.id}>
                  {/* Clicking an entry fetches and opens that specific TEI document. */}
                  <button
                    type="button"
                    onClick={() => handleSelect(doc)}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <div className="font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-gray-400">
                      {doc.language || "unknown language"}
                    </div>
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
