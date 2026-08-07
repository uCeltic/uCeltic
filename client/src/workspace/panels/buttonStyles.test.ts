import { describe, expect, it } from "vitest";
import { toolbarLabel, toolbarLabelPersistent } from "./buttonStyles";

// The staged collapse is pure CSS, so jsdom can only be asked what class a label
// carries — never what it looks like at 1100px. What these guard is the one thing
// that can silently rot: the two tiers drifting onto the same breakpoint, which
// would quietly restore the single all-or-nothing flip #174 replaced.
describe("toolbar label tiers (#174)", () => {
  it("hides the low-value label below `xl` and the high-value one below `lg`", () => {
    expect(toolbarLabel).toBe("hidden xl:inline");
    expect(toolbarLabelPersistent).toBe("hidden lg:inline");
  });

  it("keeps the two tiers on different breakpoints", () => {
    expect(toolbarLabel).not.toBe(toolbarLabelPersistent);
  });

  // Stock Tailwind breakpoints only: `responsive.ts` already pins `lg`/`xl` to the
  // layout, and a bespoke `min-[1150px]:` here would be a third number to keep in step.
  it("uses stock Tailwind breakpoints, not arbitrary pixel widths", () => {
    for (const cls of [toolbarLabel, toolbarLabelPersistent]) {
      expect(cls).not.toMatch(/\[\d+px\]/);
    }
  });
});
