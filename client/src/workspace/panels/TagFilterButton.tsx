import { useWorkspaceStore } from "../../store/workspaceStore";
import { TEI_ENTITY_TAGS, entityTagLabel } from "../../tei/entityTags";
import type { TEIEntityTag } from "../../tei/entityTags";
import { useDismissableDropdown } from "./useDismissableDropdown";
import { toolbarBtnBase, toolbarLabel } from "./buttonStyles";
import { TagIcon } from "./icons";

const btnBase = `${toolbarBtnBase} border`;
const btnIdle = `${btnBase} border-[#E5E2D6] bg-white text-[#52524F] hover:bg-[#F0EEE6]`;
const btnOpen = `${btnBase} border-[#52524F] bg-[#F0EEE6] text-[#52524F]`;

export default function TagFilterButton() {
  const selectedTagTypes = useWorkspaceStore((s) => s.selectedTagTypes);
  const setSelectedTagTypes = useWorkspaceStore((s) => s.setSelectedTagTypes);
  const { open, setOpen, ref } = useDismissableDropdown<HTMLDivElement>();

  // an empty selection filters nothing, so it reads as "All Tags", not "0 Tags"
  const label =
    selectedTagTypes.length === 0
      ? "All Tags"
      : selectedTagTypes.length === 1
        ? entityTagLabel(selectedTagTypes[0])
        : `${selectedTagTypes.length} Tags`;

  const toggle = (tag: TEIEntityTag) => {
    setSelectedTagTypes(
      selectedTagTypes.includes(tag)
        ? selectedTagTypes.filter((t) => t !== tag)
        : [...selectedTagTypes, tag],
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={open ? btnOpen : btnIdle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <TagIcon />
        <span className={toolbarLabel}>{label} ▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-md">
          {TEI_ENTITY_TAGS.map((t) => (
            <label
              key={t.tag}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-[#F0EEE6]"
            >
              <input
                type="checkbox"
                checked={selectedTagTypes.includes(t.tag)}
                onChange={() => toggle(t.tag)}
                className="accent-[#52524F]"
              />
              {t.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
