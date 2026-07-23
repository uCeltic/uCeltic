import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AdvancedSearchPopover from "./AdvancedSearchPopover";
import { useSearchStore } from "../../store/searchStore";

// The backend rejects a window_size_ratio outside 0.1–10.0
// (backend/apps/search/serializers.py), and the store sends
// `matchLength / 100` — so the slider is where that floor has to hold.
const MIN_WINDOW_SIZE_RATIO = 0.1;

beforeEach(() => {
    useSearchStore.setState({ matchLength: 130 });
});

// The popover only renders its sliders once opened.
function openPopover() {
    render(<AdvancedSearchPopover />);
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
}

describe("AdvancedSearchPopover — Match Length", () => {
    it("cannot be dragged to a ratio the search API would reject", () => {
        openPopover();

        // Dragging fully to the left is the reproduction from issue #120: the
        // slider started at 0 %, and every search run from there came back 400.
        fireEvent.change(screen.getByRole("slider", { name: /match length/i }), {
            target: { value: "0" },
        });

        expect(useSearchStore.getState().matchLength / 100).toBeGreaterThanOrEqual(
            MIN_WINDOW_SIZE_RATIO,
        );
    });
});
