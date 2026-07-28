import { useState } from "react";
import { fetchTEIDoc, listTEIDocs } from "../../api/tei";
import {
  MAX_OPEN_DOCUMENTS,
  planTEIOpen,
  teiDocumentId,
  useDocumentStore,
} from "../../store/documentStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { groupCatalogueByWork, type WorkGroup } from "../../tei/workCatalog";
import type { TEICatalogEntry } from "../../types/tei";
import { useDismissableDropdown } from "./useDismissableDropdown";
import { toolbarBtnBase, toolbarLabel } from "./buttonStyles";
import { LayersIcon } from "./icons";

/**
 * The Works opener: one control, two levels — a work, then the manuscripts that
 * carry it. It replaces the toolbar's "All Works" (a hard-coded list of three
 * works that named nothing in the database) and "Open TEI" (a flat list of every
 * document, one click one document) with the shape a reader actually works in:
 * pick the story, open the witnesses you want to compare (#152).
 *
 * It is an **opener**, not a search scope: search runs over the columns that end
 * up on screen (ADR-0015). The one thing the selection does beyond opening is
 * narrow the Tag Filter to the chosen work's entries — a one-way link, work →
 * entities, never back (#147).
 *
 * Both levels are the database's answer, grouped from the single catalogue
 * response: no work name is written down in this file, so nothing here can drift
 * from the corpus the way the list it replaces did.
 */

const btnBase = `${toolbarBtnBase} border`;
const btnIdle = `${btnBase} border-[#E5E2D6] bg-white text-[#52524F] hover:bg-[#F0EEE6]`;
const btnOpen = `${btnBase} border-[#52524F] bg-[#F0EEE6] text-[#52524F]`;
const actionBtn =
  "rounded border border-[#E5E2D6] px-2 py-1 text-xs font-medium text-[#52524F] cursor-pointer hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:text-gray-300";

export default function WorkPicker() {
  const { open, setOpen, ref } = useDismissableDropdown<HTMLDivElement>();
  const [catalogue, setCatalogue] = useState<TEICatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  // Which branch is showing its manuscripts. Held here rather than in the store
  // because it is disclosure, not a choice about the corpus; the work *choice*
  // it carries with it does go to the store, for the Tag Filter to read.
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);
  const [ticked, setTicked] = useState<number[]>([]);

  const selectedWorkId = useWorkspaceStore((s) => s.selectedWorkId);
  const setSelectedWorkId = useWorkspaceStore((s) => s.setSelectedWorkId);
  const setStatusText = useWorkspaceStore((s) => s.setStatusText);
  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const addTEIDocument = useDocumentStore((s) => s.addTEIDocument);

  const groups = groupCatalogueByWork(catalogue);
  const label =
    groups.find((g) => g.work?.id === selectedWorkId)?.label ?? "Works";

  // Slots a tick would have to spend. A document that is already open costs
  // nothing — re-opening it re-focuses its column — so it never blocks a tick.
  const freeSlots = MAX_OPEN_DOCUMENTS - openDocuments.length;
  const isOpen = (id: number) =>
    openDocuments.some((doc) => doc.id === teiDocumentId(id));
  const spend = ticked.filter((id) => !isOpen(id)).length;

  async function handleToggleMenu() {
    setOpen((v) => !v);
    // Lazy: the catalogue is asked for the first time this opens, then reused.
    if (catalogue.length === 0 && !loading) {
      setLoading(true);
      try {
        setCatalogue(await listTEIDocs());
      } finally {
        setLoading(false);
      }
    }
  }

  function handleExpand(group: WorkGroup) {
    const collapsing = expandedLabel === group.label;
    setExpandedLabel(collapsing ? null : group.label);
    setTicked([]);
    // The unassigned branch is not a work, so opening it chooses no work — the
    // Tag Filter has nothing to narrow to and goes back to every open column.
    setSelectedWorkId(collapsing ? null : (group.work?.id ?? null));
  }

  function toggleTick(id: number) {
    setTicked((current) =>
      current.includes(id)
        ? current.filter((t) => t !== id)
        : [...current, id],
    );
  }

  /**
   * Open the given documents, up to what the workspace has room for, and say
   * what happened. The cap is answered once, before the first fetch, so the
   * report is accurate — the control this replaces discovered the limit one
   * document at a time and could only `alert()` about it.
   */
  async function openDocs(ids: number[]) {
    const plan = planTEIOpen({ openDocuments }, ids);
    if (plan.toOpen.length === 0) {
      setStatusText(
        `No room for ${plan.skipped.length} more document${plan.skipped.length === 1 ? "" : "s"} — close a column first.`,
      );
      return;
    }
    try {
      for (const id of plan.toOpen) {
        addTEIDocument(await fetchTEIDoc(id));
      }
    } catch {
      setStatusText("Could not open every document — please try again.");
      return;
    }
    setStatusText(
      plan.skipped.length === 0
        ? `Opened ${plan.toOpen.length} document${plan.toOpen.length === 1 ? "" : "s"}.`
        : `Opened ${plan.toOpen.length} of ${ids.length} — close a column to open more.`,
    );
    setOpen(false);
    setTicked([]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={open ? btnOpen : btnIdle}
        onClick={handleToggleMenu}
        aria-expanded={open}
        aria-label={label}
        title={label}
        data-tour="open-works"
      >
        <LayersIcon />
        <span className={toolbarLabel}>{label} ▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-96 w-80 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-md">
          {loading ? (
            <p className="px-3 py-1.5 text-sm text-gray-400">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-1.5 text-sm text-gray-400">
              No documents found.
            </p>
          ) : (
            groups.map((group) => (
              <WorkBranch
                key={group.label}
                group={group}
                expanded={expandedLabel === group.label}
                onExpand={() => handleExpand(group)}
                ticked={ticked}
                onTick={toggleTick}
                isOpen={isOpen}
                // A manuscript that cannot fit cannot be ticked: the refusal
                // belongs where the choice is made, not in a message afterwards.
                canTick={(id) => isOpen(id) || spend < freeSlots}
                onOpenSelected={() => openDocs(ticked)}
                onOpenAll={() => openDocs(group.documents.map((d) => d.id))}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function WorkBranch({
  group,
  expanded,
  onExpand,
  ticked,
  onTick,
  isOpen,
  canTick,
  onOpenSelected,
  onOpenAll,
}: {
  group: WorkGroup;
  expanded: boolean;
  onExpand: () => void;
  ticked: number[];
  onTick: (id: number) => void;
  isOpen: (id: number) => boolean;
  canTick: (id: number) => boolean;
  onOpenSelected: () => void;
  onOpenAll: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onExpand}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm font-medium text-[#52524F] cursor-pointer hover:bg-[#F0EEE6]"
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-gray-400">
          {group.documents.length}
        </span>
      </button>

      {expanded && (
        <>
          {group.documents.map((entry) => (
            <label
              key={entry.id}
              className="flex cursor-pointer items-center gap-2 py-1.5 pl-6 pr-3 text-sm text-gray-600 hover:bg-[#F0EEE6]"
            >
              <input
                type="checkbox"
                aria-label={entry.title}
                checked={ticked.includes(entry.id)}
                disabled={!canTick(entry.id) && !ticked.includes(entry.id)}
                onChange={() => onTick(entry.id)}
                className="accent-[#52524F] disabled:cursor-not-allowed"
              />
              <span className="min-w-0 flex-1 truncate">{entry.title}</span>
              {isOpen(entry.id) && (
                <span className="shrink-0 text-xs text-gray-400">open</span>
              )}
            </label>
          ))}
          <div className="mt-1 flex gap-2 border-t border-gray-100 px-3 py-2">
            <button
              type="button"
              className={actionBtn}
              disabled={ticked.length === 0}
              onClick={onOpenSelected}
            >
              Open selected
            </button>
            <button type="button" className={actionBtn} onClick={onOpenAll}>
              Open all
            </button>
          </div>
        </>
      )}
    </div>
  );
}
