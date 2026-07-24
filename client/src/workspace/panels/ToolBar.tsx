import React, { useRef } from "react";
import mammoth from "mammoth";
import {
  useDocumentStore,
  MAX_OPEN_DOCUMENTS,
  getSearchableDocuments,
} from "../../store/documentStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import AdvancedSearchPopover from "./AdvancedSearchPopover";
import TagFilterButton from "./TagFilterButton";
import ScopeButton from "./ScopeButton";
import TEIPickerDropdown from "./TEIPickerDropdown";
import AccountMenu from "./AccountMenu";
import { secondaryBtn, toggleOnBtn } from "./buttonStyles";
import { selectAnySearching, useSearchStore } from "../../store/searchStore";
import { setQuerySourceHighlight } from "../../tei/highlight";

export default function ToolBar({
  onToggleIIIF,
}: {
  onToggleIIIF: () => void;
}) {
  const addDocument = useDocumentStore((state) => state.addDocument);
  const openDocuments = useDocumentStore((state) => state.openDocuments);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const increaseFontSize = useWorkspaceStore((state) => state.increaseFontSize);
  const decreaseFontSize = useWorkspaceStore((state) => state.decreaseFontSize);
  const showIIIF = useWorkspaceStore((state) => state.showIIIF);
  const runSearch = useSearchStore((s) => s.runSearch);
  // disable Search while ANY column is still in flight (replaces the old global flag)
  const anySearching = useSearchStore(selectAnySearching);
  const setQuery = useSearchStore((s) => s.setQuery);
  const query = useSearchStore((s) => s.query);
  const visibleDocumentIds = useDocumentStore((s) => s.visibleDocumentIds);

  //handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "txt") {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const title = file.name.replace(/\.txt$/, "");
        addDocument(title, content);
      };
      reader.readAsText(file);
    } else if (ext === "docx") {
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        const title = file.name.replace(/\.docx$/, "");
        addDocument(title, result.value);
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = "";
  };

  //check if the maximum number of documents is reached, if so, alert the user.
  const handleAddDocument = () => {
    if (openDocuments.length >= MAX_OPEN_DOCUMENTS) {
      alert("Maximum 8 documents allowed.");
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <header className="relative z-10 flex items-center justify-between gap-4 border-b border-[#D8D4C3] bg-[#E8E3CE] px-4 py-1 shadow-[0_1px_3px_rgba(82,82,79,0.08)]">
      <TagFilterButton />
      <ScopeButton />
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.docx,.tei"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className={
            openDocuments.length >= MAX_OPEN_DOCUMENTS
              ? "rounded-md border border-[#E5E2D6] bg-white px-2.5 py-1.5 text-sm font-medium text-gray-300 cursor-not-allowed"
              : secondaryBtn
          }
          onClick={handleAddDocument}
        >
          + Add Text
        </button>
      </div>

      {/* menu for selecting tei document from the database*/}
      <TEIPickerDropdown />

      {/* Search input and buttons */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <input
          type="text"
          placeholder="Search documents..."
          className="w-full max-w-lg rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
  text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-[#52524F] focus:ring-2
  focus:ring-[#52524F]/20 transition-all"
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* advanced search parameters popover */}
        <AdvancedSearchPopover />

      <button
        type="button"
        aria-label="Search"
        className={toggleOnBtn}
        disabled={anySearching}
        onClick={() => {
          // Nothing typed, nothing searched: runSearch bails on a blank query
          // per document, so returning here changes no search behaviour — it
          // just stops a click that searches nothing from clearing the mark
          // below, which would strip the on-screen results of their provenance.
          if (!query.trim()) return;
          // A typed query came from the search bar, not from text on screen, so
          // any mark an earlier selection search left behind now points at text
          // that has nothing to do with these results.
          setQuerySourceHighlight(null);
          for (const doc of getSearchableDocuments({
            openDocuments,
            visibleDocumentIds,
          })) {
            runSearch(doc.content.id, doc.id);
          }
        }}
      >
        {anySearching ? "..." : "Search"}
      </button>
      </div>
      {/* Toggle IIIF button and font size buttons*/}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decreaseFontSize}
          className={secondaryBtn}
        >
          A−
        </button>
        <button
          type="button"
          onClick={increaseFontSize}
          className={secondaryBtn}
        >
          A+
        </button>

        <button
          type="button"
          onClick={onToggleIIIF}
          className={showIIIF ? toggleOnBtn : secondaryBtn}
          aria-pressed={showIIIF}
        >
          {showIIIF ? "Hide Manuscripts" : "Show Manuscripts"}
        </button>

        <AccountMenu />
      </div>
    </header>
  );
}
