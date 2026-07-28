import type { TEINode } from "../../types/tei";

/**
 * A parsed text node, one segment per part.
 *
 * The renderer's tests all need this and none of them care about the segment
 * bookkeeping: what they are testing is what reaches the DOM, and the backend's
 * word indices only matter to the search path (see `wordRange.test.ts`).
 */
export function text(...parts: string[]): TEINode {
  return {
    type: "text",
    segments: parts.map((t, i) => ({ kind: "word", text: t, idx: i })),
  };
}
