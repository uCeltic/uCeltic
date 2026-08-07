import { useState } from "react";
import { useWorkspaceStore } from "../../store/workspaceStore";
import type { EntityKind, EntityMenuEntry } from "../../tei/entityMenu";
import { useEntityMenu } from "../../tei/useEntityMenu";
import { useDismissableDropdown } from "./useDismissableDropdown";
import {
  dropdownTriggerIdle,
  dropdownTriggerOpen,
  toolbarLabelPersistent,
} from "./buttonStyles";
import { TagIcon } from "./icons";

const GROUPS: { kind: EntityKind; label: string }[] = [
  { kind: "person", label: "Person" },
  { kind: "place", label: "Place" },
];

// One entry: its headword, the `@nymRef` code the corpus groups it under, and
// how often each visible column names it — `21 · 10 · 17 · 16`, in the order
// the columns are on screen.
//
// The code is printed rather than hidden because the headword is ours and the
// code is the corpus's: researchers cross-check against their own
// person_name_list.csv / place_name_list.csv, and the code is the only key
// those lists share with the app. It is also what tells two near-identical rows
// apart when the source file has a typo in it (`F64` and `64` are both Find).
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
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm cursor-pointer
        ${selected ? "bg-[#F0EEE6] font-medium text-[#52524F]" : "text-gray-600 hover:bg-[#F0EEE6]"}`}
    >
      <span className="min-w-0 flex-1 truncate">{entry.headword}</span>
      <span className="shrink-0 font-mono text-[11px] text-gray-400">
        {entry.id}
      </span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-gray-400">
        {entry.counts.join(" · ")}
      </span>
    </button>
  );
}

/**
 * Whether an entity answers to what the reader typed.
 *
 * Both halves of the row are searched, because both are ways in: a reader looks
 * for *Find*, and a researcher holding a name list looks for `F64`. Matching is
 * case-insensitive and by substring, which is deliberately looser than the
 * corpus's own case-sensitive group ids — `a13` typed here should reach `A13`
 * too, since the reader is looking, not joining.
 */
function matches(entry: EntityMenuEntry, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  return (
    entry.headword.toLowerCase().includes(needle) ||
    entry.id.toLowerCase().includes(needle)
  );
}

/**
 * The Tag Filter: pick one person or place, and every open column highlights
 * and navigates its own occurrences of them.
 *
 * Nothing is offered that cannot match anything. That property is what the
 * hard-coded element-name vocabulary this control started as failed twice over
 * (#147), and it is why every row here comes from the corpus: the grouping is
 * the corpus's own `@nymRef` claim, the counts are the open columns' own, and
 * the only thing supplied from outside is the name a group goes by, which no
 * TEI file in this corpus carries (#163).
 *
 * The menu is a long one — 91 entities on the corpus in hand — so it scrolls
 * within its own bounds, groups into people and places, and takes a filter that
 * matches a headword or a `@nymRef` code.
 *
 * Selecting an entity here never changes the Work opener — the link between the
 * two toolbar dropdowns runs one way, work → entities (#152).
 */
export default function TagFilterButton() {
  const selectedEntityId = useWorkspaceStore((s) => s.selectedEntityId);
  const setSelectedEntityId = useWorkspaceStore((s) => s.setSelectedEntityId);
  const { open, setOpen, ref } = useDismissableDropdown<HTMLDivElement>();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const { entries } = useEntityMenu();

  const selected = entries.find((e) => e.id === selectedEntityId);
  // nothing selected filters nothing, so it reads as "All Tags", not "0 Tags"
  const label = selected?.headword ?? "All Tags";
  const shown = entries.filter((entry) => matches(entry, filter));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={open ? dropdownTriggerOpen : dropdownTriggerIdle}
        // A filter is about this visit to the menu. Keeping it would greet the
        // next one with rows missing for a reason nothing on screen explains —
        // and the menu can be dismissed by clicking away, so the reader need
        // never have seen the box they are still being filtered by.
        onClick={() => {
          if (!open) setFilter("");
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <TagIcon />
        {/* This label is the workspace's only on-screen statement of which entity
            it is filtered to — the tag icon says "a filter", not "Find" — so it
            outlasts the labels that merely repeat their glyph (#174). */}
        <span className={toolbarLabelPersistent}>{label} ▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 flex max-h-96 w-80 flex-col rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {entries.length === 0 ? (
            // Not "no named entities in these documents" — the manuscripts
            // are full of them. What is missing is a name for the group an
            // occurrence belongs to, so the honest claim is about the filter,
            // not about the text.
            <p className="px-3 py-1.5 text-sm text-gray-400">
              No named entities to filter by yet
            </p>
          ) : (
            <>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                // Not autofocused: the trigger keeps focus so a reader who
                // opened the menu to browse can arrow through it, and one who
                // came to search is one click away.
                placeholder="Filter by name or code"
                aria-label="Filter named entities"
                className="mx-2 mb-1 shrink-0 rounded border border-gray-200 px-2 py-1 text-sm text-gray-600 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
              />
              {/* The scroll lives here rather than on the menu, so the filter
                  box stays put while 91 rows move under it. */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {shown.length === 0 && (
                  <p className="px-3 py-1.5 text-sm text-gray-400">
                    Nothing matches “{filter.trim()}”
                  </p>
                )}
                {GROUPS.map(({ kind, label: groupLabel }) => {
                  const group = shown.filter((e) => e.kind === kind);
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
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
