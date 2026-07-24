import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import TagFilterButton from "./TagFilterButton";
import { useWorkspaceStore } from "../../store/workspaceStore";

beforeEach(() => {
    useWorkspaceStore.setState({ selectedTagTypes: [] });
});

// the dropdown only exists once the trigger is clicked open
function open() {
    render(<TagFilterButton />);
    fireEvent.click(screen.getByRole("button"));
}

describe("TagFilterButton", () => {
    //Test: the values are the six TEI named-entity tag types (CONTEXT.md → Tag Filter),
    //offered as a predefined list — no free-text box of its own
    it("offers the six TEI entity tag types as checkboxes", () => {
        open();

        expect(screen.getAllByRole("checkbox")).toHaveLength(6);
        for (const label of [
            "Person",
            "Place",
            "Geographic Feature",
            "Organisation",
            "Referring String",
            "Name",
        ]) {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    //Test: ticking a box records that tag type in the store — multi-select, so a
    //second tick adds rather than replaces
    it("adds each ticked tag type to the store selection", () => {
        open();

        fireEvent.click(screen.getByLabelText("Person"));
        expect(useWorkspaceStore.getState().selectedTagTypes).toEqual(["persName"]);

        fireEvent.click(screen.getByLabelText("Place"));
        expect(useWorkspaceStore.getState().selectedTagTypes).toEqual([
            "persName",
            "placeName",
        ]);
    });

    //Test: unticking removes just that tag type
    it("removes an unticked tag type from the store selection", () => {
        useWorkspaceStore.setState({ selectedTagTypes: ["persName", "placeName"] });
        open();

        fireEvent.click(screen.getByLabelText("Person"));
        expect(useWorkspaceStore.getState().selectedTagTypes).toEqual(["placeName"]);
    });

    //Test: the trigger label reports the selection — empty means nothing is filtered
    it("labels the trigger with the current selection", () => {
        render(<TagFilterButton />);
        expect(screen.getByRole("button")).toHaveTextContent("All Tags");

        act(() => useWorkspaceStore.setState({ selectedTagTypes: ["persName"] }));
        expect(screen.getByRole("button")).toHaveTextContent("Person");

        act(() => useWorkspaceStore.setState({ selectedTagTypes: ["persName", "rs"] }));
        expect(screen.getByRole("button")).toHaveTextContent("2 Tags");
    });
});
