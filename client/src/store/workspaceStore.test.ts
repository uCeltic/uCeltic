import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "./workspaceStore";

beforeEach(() => {
    useWorkspaceStore.setState({ fontSize: 14, showIIIF: true, mode: "search" });
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
});