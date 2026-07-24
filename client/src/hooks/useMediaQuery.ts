import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query and re-render when it starts or stops matching.
 *
 * This is the deliberate, breakpoint-driven alternative to a `ResizeObserver`
 * measure-and-collapse scheme (rejected in ADR-0011): it fires only when the
 * viewport crosses a fixed breakpoint, never on every resize pixel.
 *
 * Falls back to `false` where `matchMedia` is unavailable (e.g. jsdom, SSR).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () =>
      typeof window.matchMedia === "function"
        ? window.matchMedia(query).matches
        : false,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
