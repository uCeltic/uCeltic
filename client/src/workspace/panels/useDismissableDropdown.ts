import { useEffect, useRef, useState } from "react";

/**
 * Open/close state for a toolbar dropdown that closes when you click outside it or
 * press Escape. Spread `ref` onto the element that wraps both the trigger and the
 * panel — a mousedown anywhere outside that element dismisses the panel.
 *
 * Extracted from the copy TagFilterButton and HamburgerMenu each grew; keep new
 * dismissable panels on this hook rather than pasting the listeners again. Its
 * consumers are no longer only toolbar dropdowns — the floating Feedback popover
 * (#137) sits on it too, which is what Escape was added for.
 */
export function useDismissableDropdown<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Escape is listened for regardless of where focus sits: a dropdown holding a
    // form (the Feedback popover, #137) has focus inside itself, and one that is
    // merely open has it back on the trigger — both must dismiss the same way.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}
