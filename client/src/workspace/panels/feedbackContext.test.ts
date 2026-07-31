import { beforeEach, describe, expect, it } from "vitest";
import { buildFeedbackContext } from "./feedbackContext";
import { useDocumentStore } from "../../store/documentStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import type { Document } from "../../types/document";

const DOC_A = { id: "a", title: "Betha Brigte", format: "txt", content: "text" } as Document;
const DOC_B = { id: "b", title: "Vita Brigitae", format: "txt", content: "text" } as Document;

beforeEach(() => {
  useDocumentStore.setState({
    openDocuments: [DOC_A, DOC_B],
    visibleDocumentIds: ["a"],
    activeDocumentId: "a",
  });
  useWorkspaceStore.setState({ selectedWorkId: 7 });
});

describe("buildFeedbackContext", () => {
  it("records which documents are open and which are on screen", () => {
    const context = buildFeedbackContext();

    expect(context.open_document_ids).toEqual(["a", "b"]);
    expect(context.visible_document_ids).toEqual(["a"]);
  });

  it("records the chosen work, and null when none is chosen", () => {
    expect(buildFeedbackContext().selected_work_id).toBe(7);

    useWorkspaceStore.setState({ selectedWorkId: null });

    expect(buildFeedbackContext().selected_work_id).toBeNull();
  });

  it("records the viewport and the url", () => {
    const context = buildFeedbackContext();

    expect(context.viewport).toEqual({ width: window.innerWidth, height: window.innerHeight });
    expect(context.url).toBe(window.location.href);
  });

  it("carries no document text, titles or query — only tool-usage state (ADR-0014)", () => {
    const serialized = JSON.stringify(buildFeedbackContext());

    expect(serialized).not.toContain("Betha Brigte");
    expect(serialized).not.toContain("text");
  });
});
