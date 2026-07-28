import { useState } from "react";
import { useWorkspaceStore } from "../../store/workspaceStore";
import type { EntityKind, EntityMenuEntry } from "../../tei/authority";
import { useEntityMenu } from "../../tei/useEntityMenu";
import { useDismissableDropdown } from "./useDismissableDropdown";
import {
  dropdownTriggerIdle,
  dropdownTriggerOpen,
  toolbarLabel,
} from "./buttonStyles";
import { TagIcon } from "./icons";

const GROUPS: { kind: EntityKind; label: string }[] = [
  { kind: "person", label: "Person" },
  { kind: "place", label: "Place" },
];

// One authority entry: its headword, and how often each visible column
// references it — `12 · 111 · 72`, in the order the columns are on screen.
function EntryRow({
  entry,
  selected,
  onSelect,
}: {
  entry: EntityMenuEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm cursor-pointer
        ${selected ? "bg-[#F0EEE6] font-medium text-[#52524F]" : "text-gray-600 hover:bg-[#F0EEE6]"}`}
    >
      <span className="min-w-0 flex-1 truncate">{entry.headword}</span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-gray-400">
        {entry.counts.join(" · ")}
      </span>
    </button>
  );
}

/**
 * The Tag Filter: pick one person or place, and every open column highlights
 * and navigates its own occurrences of them.
 *
 * The options are read from the open documents' `standOff` authority lists, so
 * nothing is offered that cannot match anything — that property holds by
 * construction here, not by keeping a hard-coded list in step with the corpus,
 * which is the mistake the element-name vocabulary this replaces made (#147).
 *
 * Selecting an entity here never changes the Work opener — the link between the
 * two toolbar dropdowns runs one way, work → entities (#152).
 */
export default function TagFilterButton() {
  const selectedEntityId = useWorkspaceStore((s) => s.selectedEntityId);
  const setSelectedEntityId = useWorkspaceStore((s) => s.setSelectedEntityId);
  const { open, setOpen, ref } = useDismissableDropdown<HTMLDivElement>();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { entries } = useEntityMenu();

  const selected = entries.find((e) => e.id === selectedEntityId);
  // nothing selected filters nothing, so it reads as "All Tags", not "0 Tags"
  const label = selected?.headword ?? "All Tags";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={open ? dropdownTriggerOpen : dropdownTriggerIdle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <TagIcon />
        <span className={toolbarLabel}>{label} ▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 max-h-96 w-72 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {entries.length === 0 ? (
            <p className="px-3 py-1.5 text-sm text-gray-400">
              No named entities in the open documents
            </p>
          ) : (
            GROUPS.map(({ kind, label: groupLabel }) => {
              const group = entries.filter((e) => e.kind === kind);
              if (group.length === 0) return null;
              const isCollapsed = collapsed[kind] ?? false;
              return (
                <div key={kind}>
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [kind]: !isCollapsed }))
                    }
                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer hover:bg-[#F0EEE6]"
                  >
                    <span aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
                    {groupLabel} ({group.length})
                  </button>
                  {!isCollapsed &&
                    group.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        selected={entry.id === selectedEntityId}
                        // clicking the entry you are already following stops
                        // following it, which is the only way back to "All Tags"
                        onSelect={() =>
                          setSelectedEntityId(
                            entry.id === selectedEntityId ? null : entry.id,
                          )
                        }
                      />
                    ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
