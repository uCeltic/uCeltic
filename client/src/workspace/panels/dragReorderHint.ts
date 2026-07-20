import { arrayMove } from "@dnd-kit/sortable";
import type { DragEndEvent } from "@dnd-kit/core";

/**
 * Dismissed for good once acknowledged, or once a drag-reorder proves the
 * feature was already discovered — same persistence pattern as
 * ENTRY_NOTICE_DISMISSED_KEY in components/EntryNotice.tsx.
 */
export const DRAG_REORDER_HINT_DISMISSED_KEY = "uceltic:drag-reorder-hint-dismissed";

export function dragReorderHintDismissedBefore(): boolean {
  try {
    return localStorage.getItem(DRAG_REORDER_HINT_DISMISSED_KEY) === "1";
  } catch {
    // Private-mode browsers can throw on storage access; a missing dismissal is harmless.
    return false;
  }
}

export function markDragReorderHintDismissed() {
  try {
    localStorage.setItem(DRAG_REORDER_HINT_DISMISSED_KEY, "1");
  } catch {
    // Storage unavailable: the hint simply reappears on the next load.
  }
}

// Pure reorder computation for a drag-end event: null means "no-op drag"
// (dropped outside any column, or back onto its own column).
export function computeDragEndReorder(
  event: DragEndEvent,
  visibleDocumentIds: string[],
): string[] | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;
  const oldIndex = visibleDocumentIds.indexOf(active.id as string);
  const newIndex = visibleDocumentIds.indexOf(over.id as string);
  return arrayMove(visibleDocumentIds, oldIndex, newIndex);
}
