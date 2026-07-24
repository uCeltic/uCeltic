import { useEffect, useRef, useState } from "react";

/**
 * Open/close state for a toolbar dropdown that closes when you click outside it.
 * Spread `ref` onto the element that wraps both the trigger and the panel — a
 * mousedown anywhere outside that element dismisses the panel.
 *
 * Extracted from the copy TagFilterButton and HamburgerMenu each grew; keep new
 * toolbar dropdowns on this hook rather than pasting the listener a fourth time.
 */
export function useDismissableDropdown<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return { open, setOpen, ref };
}
