import React, { useRef } from "react";
import mammoth from "mammoth";
import {
  useManuscriptStore,
  MAX_OPEN_MANUSCRIPTS,
} from "../../store/manuscriptStore";
import { useWorkspaceStore } from "../../store/workspaceStore";

export default function ToolBar() {
  const addManuscript = useManuscriptStore((state) => state.addManuscript);
  const openManuscripts = useManuscriptStore((state) => state.openManuscripts);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const increaseFontSize = useWorkspaceStore((state) => state.increaseFontSize);
  const decreaseFontSize = useWorkspaceStore((state) => state.decreaseFontSize);
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

  console.log("addManuscript type:", typeof addManuscript);
  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-[#f5f6ee] px-4 py-0.5">
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
          className="rounded-md bg-[#4F7942] px-2.5 py-1.5 text-sm font-medium text-white hover:bg-[#4F7942]"
          onClick={handleAddManuscript}
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

      {/* Toggle IIIF button and font size buttons*/}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decreaseFontSize}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium
  text-gray-700 hover:bg-gray-50"
        >
          A−
        </button>
        <button
          type="button"
          onClick={increaseFontSize}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium
  text-gray-700 hover:bg-gray-50"
        >
          A+
        </button>

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
