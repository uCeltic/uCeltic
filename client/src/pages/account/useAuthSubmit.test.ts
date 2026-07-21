import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAuthSubmit } from "./useAuthSubmit";
import { AuthError } from "../../api/auth";

const FALLBACK = "Could not do the thing. Please try again.";

describe("useAuthSubmit", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useAuthSubmit(FALLBACK));

    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it("marks the form busy while the action is in flight", async () => {
    let release: () => void = () => {};
    const action = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });

    const { result } = renderHook(() => useAuthSubmit(FALLBACK));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.run(action);
    });
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      release();
      await pending;
    });
  });

  it("stays busy after a success, since the page it belongs to is on its way out", async () => {
    const { result } = renderHook(() => useAuthSubmit(FALLBACK));

    await act(async () => {
      await result.current.run(async () => {});
    });

    expect(result.current.submitting).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("quotes the server's own wording and re-arms the form when the call fails", async () => {
    const { result } = renderHook(() => useAuthSubmit(FALLBACK));

    await act(async () => {
      await result.current.run(async () => {
        throw new AuthError([{ message: "Too many requests.", code: "ratelimited" }]);
      });
    });

    expect(result.current.error).toBe("Too many requests.");
    expect(result.current.submitting).toBe(false);
  });

  it("falls back to the caller's wording when the failure carries none of its own", async () => {
    const { result } = renderHook(() => useAuthSubmit(FALLBACK));

    await act(async () => {
      await result.current.run(async () => {
        throw new TypeError("network down");
      });
    });

    expect(result.current.error).toBe(FALLBACK);
    expect(result.current.submitting).toBe(false);
  });

  it("drops a stale error as soon as the next attempt starts", async () => {
    const { result } = renderHook(() => useAuthSubmit(FALLBACK));

    await act(async () => {
      await result.current.run(async () => {
        throw new TypeError("network down");
      });
    });
    expect(result.current.error).toBe(FALLBACK);

    let release: () => void = () => {};
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.run(() => new Promise<void>((resolve) => (release = resolve)));
    });

    expect(result.current.error).toBeNull();

    await act(async () => {
      release();
      await pending;
    });
  });

  it("clears the error on demand, for a page that rejects a submit before calling out", async () => {
    const { result } = renderHook(() => useAuthSubmit(FALLBACK));

    await act(async () => {
      await result.current.run(async () => {
        throw new TypeError("network down");
      });
    });

    act(() => result.current.clearError());

    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });
});
