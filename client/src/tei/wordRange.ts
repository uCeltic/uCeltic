import type { TEIAnchor, TEIWordEntry } from "../types/tei";

/**
 * Build a Map<wordIdx, anchorId> from word_array.
 * Compute once per doc; cache in store.
 */
export function buildWordToAnchor(wordArray: TEIWordEntry[]): Map<number, number> {
  const m = new Map<number, number>();
  wordArray.forEach((entry, idx) => m.set(idx, entry.a));
  return m;
}

/**
 * Build a Map<anchorId, TEIAnchor> for O(1) lookup.
 */
export function buildAnchorsById(anchors: TEIAnchor[]): Map<number, TEIAnchor> {
  const m = new Map<number, TEIAnchor>();
  for (const a of anchors) m.set(a.id, a);
  return m;
}

/**
 * Given a half-open word range [wordStart, wordEnd) inside a column,
 * return one or more DOM Ranges that exactly cover those words.
 *
 * Words may span multiple anchors (e.g. when a query crosses <l> boundaries),
 * so we group by anchor and build one Range per group.
 */
export function buildRangesForWordSpan(
  columnEl: Element,
  anchorsById: Map<number, TEIAnchor>,
  wordToAnchor: Map<number, number>,
  wordStart: number,
  wordEnd: number,
): Range[] {
  // Group hit word indices by anchor.
  const byAnchor = new Map<number, number[]>();
  for (let i = wordStart; i < wordEnd; i++) {
    const aId = wordToAnchor.get(i);
    if (aId === undefined) continue;
    let arr = byAnchor.get(aId);
    if (!arr) {
      arr = [];
      byAnchor.set(aId, arr);
    }
    arr.push(i);
  }

  const ranges: Range[] = [];

  for (const [anchorId, wordIdxs] of byAnchor) {
    const anchor = anchorsById.get(anchorId);
    if (!anchor) continue;

    const elementEl = columnEl.querySelector(
      `[data-tei-anchor-id="${anchorId}"]`,
    );
    if (!elementEl) continue;

    // Pick the char-offsets of the hit words in this anchor.
    const wantSet = new Set(wordIdxs);
    const offsets = anchor.word_char_offsets.filter(([idx]) => wantSet.has(idx));
    if (offsets.length === 0) continue;

    const charStart = Math.min(...offsets.map(([, s]) => s));
    const charEnd = Math.max(...offsets.map(([, , e]) => e));

    const range = rangeFromCharOffsets(elementEl, charStart, charEnd);
    if (range) ranges.push(range);
  }

  return ranges;
}

/**
 * Walk text nodes inside `el` and translate a [charStart, charEnd) range —
 * expressed against the concatenated textContent of the element — into a
 * DOM Range with (Text node, offset) start/end.
 *
 * The order of TreeWalker over text nodes must match the order backend
 * parse.py concatenates el.text + child.tail. lxml gives pre-order with
 * el.text first, then for each child its subtree, then child.tail.
 * TreeWalker.SHOW_TEXT yields text nodes in document order = same thing.
 */
function rangeFromCharOffsets(
    el: Element,
    charStart: number,
    charEnd: number,
  ): Range | null {
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node: Node) {
          return node.parentNode === el
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      },
    );

    let pos = 0;
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const len = node.textContent?.length ?? 0;
      const nodeStart = pos;
      const nodeEnd = pos + len;

      if (!startNode && nodeEnd > charStart) {
        startNode = node;
        startOffset = charStart - nodeStart;
      }
      if (nodeEnd >= charEnd) {
        endNode = node;
        endOffset = charEnd - nodeStart;
        break;
      }
      pos = nodeEnd;
    }

    if (!startNode || !endNode) return null;

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  }