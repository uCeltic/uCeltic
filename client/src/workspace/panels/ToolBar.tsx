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
import WorkPicker from "./WorkPicker";
import HamburgerMenu from "./HamburgerMenu";
import {
  secondaryBtn,
  toggleOnBtn,
  toolbarBtnBase,
  toolbarLabel,
} from "./buttonStyles";
import { BookIcon, FilePlusIcon, SearchIcon } from "./icons";
import { selectAnySearching, useSearchStore } from "../../store/searchStore";
import { setQuerySourceHighlight } from "../../tei/highlight";
import { useTourStore } from "../../store/tourStore";

export default function ToolBar({
  onToggleIIIF,
}: {
  onToggleIIIF: () => void;
}) {
  const addDocument = useDocumentStore((state) => state.addDocument);
  const openDocuments = useDocumentStore((state) => state.openDocuments);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showIIIF = useWorkspaceStore((state) => state.showIIIF);
  const runSearch = useSearchStore((s) => s.runSearch);
  // disable Search while ANY column is still in flight (replaces the old global flag)
  const anySearching = useSearchStore(selectAnySearching);
  const setQuery = useSearchStore((s) => s.setQuery);
  const query = useSearchStore((s) => s.query);
  const visibleDocumentIds = useDocumentStore((s) => s.visibleDocumentIds);
  const startTour = useTourStore((s) => s.start);

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
      {/* Works → their manuscripts: the one control that both names the work
          being read and opens its witnesses (#152) */}
      <WorkPicker />
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
          aria-label="Add Text"
          title="Add Text"
          data-tour="add-text"
          className={
            openDocuments.length >= MAX_OPEN_DOCUMENTS
              ? `${toolbarBtnBase} border border-[#E5E2D6] bg-white text-gray-300 !cursor-not-allowed`
              : secondaryBtn
          }
          onClick={handleAddDocument}
        >
          <FilePlusIcon />
          <span className={toolbarLabel}>Add Text</span>
        </button>
      </div>

      {/* Search input and buttons */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <input
          type="text"
          placeholder="Search documents..."
          className="w-full min-w-0 max-w-lg rounded-md border border-gray-300 bg-white px-3 py-2 text-sm
  text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-[#52524F] focus:ring-2
  focus:ring-[#52524F]/20 transition-all"
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* advanced search parameters popover */}
        <AdvancedSearchPopover />

      <button
        type="button"
        aria-label="Search"
        title="Search"
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
        <SearchIcon />
        <span className={toolbarLabel}>{anySearching ? "..." : "Search"}</span>
      </button>
      </div>
      {/* Manuscript toggle stays top-level; low-frequency controls live in the menu (#123) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleIIIF}
          className={showIIIF ? toggleOnBtn : secondaryBtn}
          aria-pressed={showIIIF}
          // Client-requirement term: the label/tooltip stays "Manuscripts" and is
          // distinguished by the book icon — never renamed "Books" (CONTEXT.md).
          aria-label={showIIIF ? "Hide Manuscripts" : "Show Manuscripts"}
          title={showIIIF ? "Hide Manuscripts" : "Show Manuscripts"}
          data-tour="manuscripts"
        >
          <BookIcon />
          <span className={toolbarLabel}>
            {showIIIF ? "Hide Manuscripts" : "Show Manuscripts"}
          </span>
        </button>

        {/* Re-opens the onboarding tour on demand; icon-only, so it stays compact
            at every breakpoint (#125). */}
        <button
          type="button"
          onClick={startTour}
          aria-label="Help"
          title="Help"
          className={secondaryBtn}
        >
          ?
        </button>

        <HamburgerMenu />
      </div>
    </header>
  );
}
