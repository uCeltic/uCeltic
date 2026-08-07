import { describe, expect, it } from "vitest";
import { toolbarLabelFirstToGo, toolbarLabelLastToGo } from "./buttonStyles";

// The staged collapse is pure CSS, so jsdom can only be asked what class a label
// carries — never what it looks like at 1100px. This is the one place the two
// breakpoints are pinned; every other test names a tier by importing its constant,
// so the values live here and nowhere else. What that guards is the failure the
// scheme is prone to: the two tiers drifting onto one breakpoint, quietly restoring
// the single all-or-nothing flip #174 replaced.
describe("toolbar label tiers (#174)", () => {
  it("hides the label that repeats its icon below `xl`, and the rest below `lg`", () => {
    expect(toolbarLabelFirstToGo).toBe("hidden xl:inline");
    expect(toolbarLabelLastToGo).toBe("hidden lg:inline");
  });

  // Stock Tailwind breakpoints only: `responsive.ts` already pins `lg`/`xl` to the
  // layout, and a bespoke `min-[1150px]:` here would be a third number to keep in step.
  it("uses stock Tailwind breakpoints, not arbitrary pixel widths", () => {
    for (const cls of [toolbarLabelFirstToGo, toolbarLabelLastToGo]) {
      expect(cls).not.toMatch(/\[\d+px\]/);
    }
  });
});
