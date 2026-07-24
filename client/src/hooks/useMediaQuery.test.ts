import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMediaQuery } from "./useMediaQuery";

// A controllable matchMedia stand-in: jsdom ships none, so tests must supply one.
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  let matches = initialMatches;
  const mql = {
    get matches() {
      return matches;
    },
    media: "",
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;
  return {
    // Flip the query result and fire the change event, as a real breakpoint cross would.
    set(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb());
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  // matchMedia is a global we overwrote; drop it so it can't leak between tests.
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("useMediaQuery", () => {
  it("returns the query's current match state on mount", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023px)"));
    expect(result.current).toBe(true);
  });

  it("re-renders when the query starts matching (window shrinks past the breakpoint)", () => {
    const media = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023px)"));
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);
  });

  it("re-renders when the query stops matching (window grows back)", () => {
    const media = installMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023px)"));
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const media = installMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 1023px)"));
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it("returns false when matchMedia is unavailable rather than throwing", () => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023px)"));
    expect(result.current).toBe(false);
  });
});
