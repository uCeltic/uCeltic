import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "./workspaceStore";
import { logEvent } from "../api/log";

// mock the network side effect so tests can assert on emitted events
vi.mock("../api/log", () => ({ logEvent: vi.fn() }));
const mockedLogEvent = vi.mocked(logEvent);

beforeEach(() => {
    mockedLogEvent.mockReset();
    useWorkspaceStore.setState({
        fontSize: 14,
        showIIIF: true,
        selectedWorkIds: [],
        selectedEntityId: null,
        entityIndexByDocument: {},
    });
});

describe("workspaceStore", () => {
    
    //Test: increaseFontSize steps up but clamps at 24
    it("increaseFontSize steps up but clamps at 24", () => {
        const { increaseFontSize } = useWorkspaceStore.getState();

        increaseFontSize();
        expect(useWorkspaceStore.getState().fontSize).toBe(16);

        useWorkspaceStore.setState({ fontSize: 24 });
        increaseFontSize();
        expect(useWorkspaceStore.getState().fontSize).toBe(24);
    });

    //Test: toggleIIIF flips the manuscript panel visibility
    it("toggleIIIF flips the manuscript panel visibility", () => {
        useWorkspaceStore.getState().toggleIIIF();
        expect(useWorkspaceStore.getState().showIIIF).toBe(false);

        useWorkspaceStore.getState().toggleIIIF();
        expect(useWorkspaceStore.getState().showIIIF).toBe(true);
    });

    //Test: the Tag Filter starts with nothing selected — every entity reads normally
    it("starts with no entity selected", () => {
        expect(useWorkspaceStore.getState().selectedEntityId).toBeNull();
    });

    //Test: the Tag Filter is single-select — one entity id at a time (#147)
    it("setSelectedEntityId replaces the selection rather than adding to it", () => {
        useWorkspaceStore.getState().setSelectedEntityId("fionn");
        expect(useWorkspaceStore.getState().selectedEntityId).toBe("fionn");

        useWorkspaceStore.getState().setSelectedEntityId("cailte");
        expect(useWorkspaceStore.getState().selectedEntityId).toBe("cailte");

        useWorkspaceStore.getState().setSelectedEntityId(null);
        expect(useWorkspaceStore.getState().selectedEntityId).toBeNull();
    });

    //Test: each column navigates its own occurrences, clamped at both ends —
    //the same shape searchStore's result navigation already has
    it("navigates one column's occurrences without touching another's", () => {
        const { nextEntityOccurrence } = useWorkspaceStore.getState();

        nextEntityOccurrence("doc-a", 12);
        nextEntityOccurrence("doc-a", 12);
        expect(useWorkspaceStore.getState().entityIndexByDocument).toEqual({
            "doc-a": 2,
        });

        nextEntityOccurrence("doc-b", 3);
        expect(useWorkspaceStore.getState().entityIndexByDocument).toEqual({
            "doc-a": 2,
            "doc-b": 1,
        });
    });

    it("clamps at the last occurrence rather than wrapping", () => {
        const { nextEntityOccurrence } = useWorkspaceStore.getState();

        nextEntityOccurrence("doc-a", 2);
        nextEntityOccurrence("doc-a", 2);
        expect(useWorkspaceStore.getState().entityIndexByDocument["doc-a"]).toBe(1);
    });

    it("clamps at the first occurrence rather than wrapping", () => {
        useWorkspaceStore.getState().prevEntityOccurrence("doc-a");
        expect(useWorkspaceStore.getState().entityIndexByDocument["doc-a"]).toBe(0);
    });

    //Test: a new entity starts every column at its own first occurrence
    it("resets every column's position when the selected entity changes", () => {
        useWorkspaceStore.setState({ entityIndexByDocument: { "doc-a": 5 } });

        useWorkspaceStore.getState().setSelectedEntityId("fionn");
        expect(useWorkspaceStore.getState().entityIndexByDocument).toEqual({});
    });
});

describe("workspaceStore analytics", () => {
    //Test: which person or place a reader singles out is the Tag Filter's whole
    //signal, so selecting one emits tag_entity_selected (ADR-0003)
    it("logs tag_entity_selected with the chosen entity", () => {
        useWorkspaceStore.getState().setSelectedEntityId("fionn");
        expect(mockedLogEvent).toHaveBeenCalledOnce();
        expect(mockedLogEvent).toHaveBeenCalledWith("tag_entity_selected", {
            entity_id: "fionn",
        });
    });

    //Test: clearing is a change of intent too — the reader stopped following
    //that person, which is exactly what the study wants to see
    it("logs tag_entity_selected when the selection is cleared", () => {
        useWorkspaceStore.getState().setSelectedEntityId("fionn");
        mockedLogEvent.mockClear();

        useWorkspaceStore.getState().setSelectedEntityId(null);
        expect(mockedLogEvent).toHaveBeenCalledWith("tag_entity_selected", {
            entity_id: null,
        });
    });

    //Test: re-selecting the same entity is a no-op — logs nothing
    it("does not log tag_entity_selected when the selection doesn't change", () => {
        useWorkspaceStore.getState().setSelectedEntityId("fionn");
        mockedLogEvent.mockClear();

        useWorkspaceStore.getState().setSelectedEntityId("fionn");
        expect(mockedLogEvent).not.toHaveBeenCalled();
    });

    //Test: toggling IIIF logs one iiif_toggled event with the new state
    it("logs iiif_toggled with the new visibility state", () => {
        useWorkspaceStore.getState().toggleIIIF();
        expect(mockedLogEvent).toHaveBeenCalledOnce();
        expect(mockedLogEvent).toHaveBeenCalledWith("iiif_toggled", { on: false });

        mockedLogEvent.mockClear();
        useWorkspaceStore.getState().toggleIIIF();
        expect(mockedLogEvent).toHaveBeenCalledWith("iiif_toggled", { on: true });
    });

    //Test: increasing font size logs one font_size_changed event with from/to
    it("logs font_size_changed when increasing", () => {
        useWorkspaceStore.getState().increaseFontSize();
        expect(mockedLogEvent).toHaveBeenCalledOnce();
        expect(mockedLogEvent).toHaveBeenCalledWith("font_size_changed", {
            from: 14,
            to: 16,
        });
    });

    //Test: decreasing font size logs one font_size_changed event with from/to
    it("logs font_size_changed when decreasing", () => {
        useWorkspaceStore.getState().decreaseFontSize();
        expect(mockedLogEvent).toHaveBeenCalledOnce();
        expect(mockedLogEvent).toHaveBeenCalledWith("font_size_changed", {
            from: 14,
            to: 12,
        });
    });

    //Test: hitting the clamp (max or min) is a no-op — logs nothing
    it("does not log font_size_changed when clamped at the max", () => {
        useWorkspaceStore.setState({ fontSize: 24 });
        useWorkspaceStore.getState().increaseFontSize();
        expect(mockedLogEvent).not.toHaveBeenCalled();
    });

    it("does not log font_size_changed when clamped at the min", () => {
        useWorkspaceStore.setState({ fontSize: 10 });
        useWorkspaceStore.getState().decreaseFontSize();
        expect(mockedLogEvent).not.toHaveBeenCalled();
    });

    //Test: changing the Work scope logs one scope_changed event with selected_work_ids
    it("logs scope_changed with the new selection", () => {
        useWorkspaceStore.getState().setSelectedWorkIds(["tain"]);
        expect(mockedLogEvent).toHaveBeenCalledOnce();
        expect(mockedLogEvent).toHaveBeenCalledWith("scope_changed", {
            selected_work_ids: ["tain"],
        });
    });

    //Test: setting an identical scope again is a no-op — logs nothing
    it("does not log scope_changed when the selection doesn't change", () => {
        useWorkspaceStore.getState().setSelectedWorkIds(["tain"]);
        mockedLogEvent.mockClear();

        useWorkspaceStore.getState().setSelectedWorkIds(["tain"]);
        expect(mockedLogEvent).not.toHaveBeenCalled();
    });
});