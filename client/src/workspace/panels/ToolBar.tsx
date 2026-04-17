import React, { useRef } from "react";
import mammoth from "mammoth";
import {
  useManuscriptStore,
  MAX_OPEN_MANUSCRIPTS,
} from "../../store/manuscriptStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import AdvancedSearchPopover from "./AdvancedSearchPopover";
import ModeButton from "./ModeButton";
import ScopeButton from "./ScopeButton";

const secondaryBtn =
  "rounded-md border border-[#E5E2D6] bg-white px-2.5 py-1.5 text-sm font-medium text-[#52524F] cursor-pointer transition-all hover:bg-[#F0EEE6] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

const toggleOnBtn =
  "rounded-md border border-[#52524F] bg-[#52524F] px-2.5 py-1.5 text-sm font-medium text-white cursor-pointer transition-all hover:bg-[#3F3F3C] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30";

export default function ToolBar({
  onToggleIIIF,
}: {
  onToggleIIIF: () => void;
}) {
  const addManuscript = useManuscriptStore((state) => state.addManuscript);
  const openManuscripts = useManuscriptStore((state) => state.openManuscripts);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const increaseFontSize = useWorkspaceStore((state) => state.increaseFontSize);
  const decreaseFontSize = useWorkspaceStore((state) => state.decreaseFontSize);
  const showIIIF = useWorkspaceStore((state) => state.showIIIF);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "txt") {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const title = file.name.replace(/\.txt$/, "");
        addManuscript(title, content);
      };
      reader.readAsText(file);
    } else if (ext === "docx") {
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        const title = file.name.replace(/\.docx$/, "");
        addManuscript(title, result.value);
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = "";
  };

  const handleAddManuscript = () => {
    if (openManuscripts.length >= MAX_OPEN_MANUSCRIPTS) {
      alert("Maximum 8 manuscripts allowed.");
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <header className="relative z-10 flex items-center justify-between gap-4 border-b border-[#D8D4C3] bg-[#E8E3CE] px-4 py-1 shadow-[0_1px_3px_rgba(82,82,79,0.08)]">
      <ModeButton />
      <ScopeButton />
      {/* Add Manuscript button */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.docx"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className={
            openManuscripts.length >= MAX_OPEN_MANUSCRIPTS
              ? "rounded-md border border-[#E5E2D6] bg-white px-2.5 py-1.5 text-sm font-medium text-gray-300 cursor-not-allowed"
              : secondaryBtn
          }
          onClick={handleAddManuscript}
        >
          + Add Text
        </button>
      </div>

      {/* Search input and buttons */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <input
          type="text"
          placeholder="Search manuscripts..."
          className="w-full max-w-lg rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-[#52524F] focus:ring-2 focus:ring-[#52524F]/20 transition-all"
        />

        <button type="button" className={toggleOnBtn}>
          Search
        </button>

        <AdvancedSearchPopover />
      </div>

      {/* Toggle IIIF button and font size buttons*/}
      <div className="flex items-center gap-2">
        <button type="button" onClick={decreaseFontSize} className={secondaryBtn}>
          A−
        </button>
        <button type="button" onClick={increaseFontSize} className={secondaryBtn}>
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
      </div>
    </header>
  );
}
