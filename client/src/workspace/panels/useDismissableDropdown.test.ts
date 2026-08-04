import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDismissableDropdown } from "./useDismissableDropdown";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useDismissableDropdown", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useDismissableDropdown());

    expect(result.current.open).toBe(false);
  });

  it("closes on a mousedown outside the ref'd element", () => {
    const { result } = renderHook(() => useDismissableDropdown<HTMLDivElement>());

    // Anchor the ref to a real node, then open the dropdown.
    const inside = document.createElement("div");
    document.body.appendChild(inside);
    act(() => {
      result.current.ref.current = inside;
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    act(() => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(result.current.open).toBe(false);
  });

  it("closes on Escape", () => {
    const { result } = renderHook(() => useDismissableDropdown<HTMLDivElement>());

    const inside = document.createElement("div");
    document.body.appendChild(inside);
    act(() => {
      result.current.ref.current = inside;
      result.current.setOpen(true);
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(result.current.open).toBe(false);
  });

  it("ignores other keys", () => {
    const { result } = renderHook(() => useDismissableDropdown<HTMLDivElement>());

    act(() => result.current.setOpen(true));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });

    expect(result.current.open).toBe(true);
  });

  it("stays open on a mousedown inside the ref'd element", () => {
    const { result } = renderHook(() => useDismissableDropdown<HTMLDivElement>());

    const inside = document.createElement("div");
    const child = document.createElement("button");
    inside.appendChild(child);
    document.body.appendChild(inside);
    act(() => {
      result.current.ref.current = inside;
      result.current.setOpen(true);
    });

    act(() => {
      child.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(result.current.open).toBe(true);
  });
});
