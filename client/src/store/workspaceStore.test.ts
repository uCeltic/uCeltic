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
        selectedTagTypes: [],
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

    //Test: the Tag Filter starts empty — no tag type is filtered out by default
    it("starts with no Tag Filter selection", () => {
        expect(useWorkspaceStore.getState().selectedTagTypes).toEqual([]);
    });

    //Test: the Tag Filter selection is plain state — set it, read it back
    it("setSelectedTagTypes stores the selection", () => {
        useWorkspaceStore.getState().setSelectedTagTypes(["persName", "placeName"]);
        expect(useWorkspaceStore.getState().selectedTagTypes).toEqual([
            "persName",
            "placeName",
        ]);
    });
});

describe("workspaceStore analytics", () => {
    //Test: the Tag Filter is a shell — the closed taxonomy (ADR-0003) has no event
    //for it, so changing the selection emits nothing
    it("does not log anything when the Tag Filter selection changes", () => {
        useWorkspaceStore.getState().setSelectedTagTypes(["persName"]);
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