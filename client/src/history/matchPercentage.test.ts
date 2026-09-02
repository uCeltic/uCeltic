import { describe, expect, it } from "vitest";
import { matchPercentage } from "./matchPercentage";

describe("matchPercentage", () => {
  it("reads an identical passage as a full match", () => {
    expect(matchPercentage(0)).toBe("100%");
  });

  it("turns a dissimilarity into a similarity, so higher means closer", () => {
    expect(matchPercentage(0.12)).toBe("88%");
    expect(matchPercentage(0.41)).toBe("59%");
  });

  it("rounds to a whole percent — a stored score has more digits than a reader wants", () => {
    expect(matchPercentage(0.1234)).toBe("88%");
  });

  it("never shows a negative match, however large a future score gets", () => {
    // The store deliberately puts no upper bound on `score`, so a matcher change could
    // one day return one above 1. "−20% match" is not a thing to show a reader.
    expect(matchPercentage(1.2)).toBe("0%");
  });
});
