import { useDocumentStore } from "../../store/documentStore";
import { useWorkspaceStore } from "../../store/workspaceStore";

/**
 * The snapshot that makes a bug report reproducible without the visitor describing
 * their screen (#137, ADR-0014): which documents they had open, which were on screen,
 * which work the opener was narrowed to, how big the window was, and where they were.
 *
 * The visible ids are the spec's "current scope", not an extra: search runs over the
 * open columns (ADR-0015), so what was on screen *is* what a search would have covered.
 *
 * Everything here is tool-usage state — the same kind of thing `BehaviorEvent.payload`
 * already records. Deliberately *not* included: document text, titles, the search
 * query, the current selection. Those are content, and the only content a Feedback
 * carries is what the visitor chose to type into `body` / `contact`.
 *
 * Read through `getState()` rather than a hook: this is assembled once at submit time,
 * and the popover has no reason to re-render when a column scrolls.
 */
export function buildFeedbackContext(): Record<string, unknown> {
  const { openDocuments, visibleDocumentIds } = useDocumentStore.getState();
  const { selectedWorkId } = useWorkspaceStore.getState();

  return {
    open_document_ids: openDocuments.map((doc) => doc.id),
    visible_document_ids: [...visibleDocumentIds],
    selected_work_id: selectedWorkId,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    url: window.location.href,
  };
}
