import { useState } from "react";
import {
  freeColumnSlots,
  manuscriptColumnId,
  useDocumentStore,
} from "../../store/documentStore";
import { MANUSCRIPTS, type ManuscriptId } from "../manuscripts";
import { useDismissableDropdown } from "./useDismissableDropdown";
import {
  dropdownTriggerIdle,
  dropdownTriggerOpen,
  toolbarLabelFirstToGo,
} from "./buttonStyles";
import { BookIcon } from "./icons";

/**
 * The Manuscripts opener: a flat list of the Manuscripts to tick, then *Open
 * selected* — each one opens as a Column in the strip, beside the Documents
 * (ADR-0025). Shaped like the Works opener on purpose, so the two ways into
 * the strip behave alike: the same `open` mark, the same refusal of a tick
 * there is no room for, read from the same free-slot count.
 *
 * It replaces the Show / Hide Manuscripts toggle and the side panel it
 * switched. The word stays "Manuscripts" in the label, `aria-label` and tooltip
 * — a client-requirement term, told apart from Documents by the book icon and
 * never renamed "Books" (CONTEXT.md → Manuscript).
 */

const LABEL = "Manuscripts";

const actionBtn =
  "rounded border border-[#E5E2D6] px-2 py-1 text-xs font-medium text-[#52524F] cursor-pointer hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:text-gray-300";

// Bring a Column into view in the sideways-scrolling strip. Deferred a frame:
// a Column opened by this click has not rendered yet.
function scrollColumnIntoView(id: ManuscriptId) {
  requestAnimationFrame(() => {
    document
      .querySelector(`[data-manuscript-column-id="${manuscriptColumnId(id)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  });
}

export default function ManuscriptPicker() {
  const { open, setOpen, ref } = useDismissableDropdown<HTMLDivElement>();
  const [ticked, setTicked] = useState<ManuscriptId[]>([]);

  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const openManuscripts = useDocumentStore((s) => s.openManuscripts);
  const openManuscript = useDocumentStore((s) => s.openManuscript);

  // An open Manuscript costs no slot — ticking it re-focuses its Column — so
  // it never blocks a tick, exactly as an open Version does in the Works menu.
  const freeSlots = freeColumnSlots({ openDocuments, openManuscripts });
  const isOpen = (id: ManuscriptId) => openManuscripts.includes(id);
  const spend = ticked.filter((id) => !isOpen(id)).length;
  const canTick = (id: ManuscriptId) => isOpen(id) || spend < freeSlots;

  function toggleTick(id: ManuscriptId) {
    setTicked((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  function openSelected() {
    // In list order, so the Columns land in the strip in the order the menu
    // shows them, whatever order they were ticked in.
    const ids = MANUSCRIPTS.map((m) => m.id).filter((id) => ticked.includes(id));
    for (const id of ids) openManuscript(id);
    const last = ids.at(-1);
    if (last !== undefined) scrollColumnIntoView(last);
    setTicked([]);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={open ? dropdownTriggerOpen : dropdownTriggerIdle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={LABEL}
        title={LABEL}
        data-tour="manuscripts"
      >
        <BookIcon />
        {/* The first label the bar drops (ADR-0020): a book beside a ▾ already
            says what it says. */}
        <span className={toolbarLabelFirstToGo}>{LABEL} ▾</span>
      </button>

      {open && (
        <div
          data-tour-panel=""
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {MANUSCRIPTS.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-start gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-[#F0EEE6]"
            >
              <input
                type="checkbox"
                aria-label={m.label}
                checked={ticked.includes(m.id)}
                disabled={!canTick(m.id) && !ticked.includes(m.id)}
                onChange={() => toggleTick(m.id)}
                className="mt-0.5 accent-[#52524F] disabled:cursor-not-allowed"
              />
              <span className="min-w-0 flex-1">{m.label}</span>
              {isOpen(m.id) && (
                <span className="mt-0.5 shrink-0 text-xs text-gray-400">open</span>
              )}
            </label>
          ))}
          <div className="mt-1 flex gap-2 border-t border-gray-100 px-3 py-2">
            <button
              type="button"
              className={actionBtn}
              disabled={ticked.length === 0}
              onClick={openSelected}
            >
              Open selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
