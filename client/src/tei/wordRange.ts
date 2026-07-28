import type { TEIAnchor } from "../types/tei";

/**
 * Build a Map<wordIdx, anchorId[]> — every anchor the ith word has characters in.
 *
 * Editorial TEI marks up inside words, so `tal<expan>am</expan>` is the single
 * word `talam` with `tal` in the line and `am` in the expan (#145). A quarter to
 * a half of the words in a real manuscript file are like this, so one word maps
 * to a list of anchors, not to one.
 *
 * The anchors are the authority here, not word_array. `word_array[i].a` names
 * only the anchor a word STARTS in — enough to label a result with a line
 * number, not enough to paint it.
 *
 * Compute once per doc; cache in store.
 */
export function buildWordToAnchors(anchors: TEIAnchor[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const anchor of anchors) {
    for (const [wordIdx] of anchor.word_char_offsets) {
      const ids = m.get(wordIdx);
      if (ids) ids.push(anchor.id);
      else m.set(wordIdx, [anchor.id]);
    }
  }
  return m;
}

/**
 * Build a Map<anchorId, complete anchor info> 
 * Get the complete anchor info from on the anchorId
 */
export function buildAnchorsById(anchors: TEIAnchor[]): Map<number, TEIAnchor> {
  const m = new Map<number, TEIAnchor>();
  for (const a of anchors) m.set(a.id, a);
  return m;
}

/**
 * Given a word range [wordStart, wordEnd) inside a text viewer column,
 * return one or more DOM Ranges that exactly cover those words.
 *
 * Words may span multiple anchors,
 * so we group by anchor and build one Range per group.
 */
export function buildRangesForWordSpan(
  columnEl: Element, // means the text viewer column/doc_id
  anchorsById: Map<number, TEIAnchor>,
  wordToAnchors: Map<number, number[]>,
  wordStart: number,
  wordEnd: number,
): Range[] {
  // Group hit word indices by anchor.
  // Build a byAnchor Map<anchorId, result word indices> for each anchor
  // A word contributes to every anchor it has characters in, so a single word
  // can open several groups.
  const byAnchor = new Map<number, number[]>();
  for (let i = wordStart; i < wordEnd; i++) {
    for (const aId of wordToAnchors.get(i) ?? []) {
      let arr = byAnchor.get(aId);
      if (!arr) {
        arr = [];
        byAnchor.set(aId, arr);
      }
      arr.push(i);
    }
  }

  const ranges: Range[] = [];
  // wordIdxs is a list
  // anchor.word_char_offsets is a list of [word_idx, char_start, char_end]
  // anchor.word_char_offsets
  // [
  //   [8, 0, 4], [wordIdx, charStart, charEnd]
  //   [9, 5, 9],
  //   [10, 10, 15],
  //   [11, 16, 20],
  //   [12, 21, 25]
  // ]

  // wantSet = Set { 10, 11 }
  //after filtering
  // offsets = [
  //   [10, 10(charStart), 15],
  //   [11, 16, 20(charEnd)]
  // ]
  // charStart = 10
  // charEnd = 20
  for (const [anchorId, wordIdxs] of byAnchor) {
    const anchor = anchorsById.get(anchorId);
    if (!anchor) continue;
    // Find the element by the anchorId, this element is the anchor element/tag element
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
    //Something like  a iterator collecting all the nodes that have text.
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
    // iterate the text nodes using the walker
    // basically counting the char to find the charStart and charEnd
    //startNode and endNode are necessary because we need to know the starting and ending node to create the Range(explorer).
    let pos = 0; //For counting, currrent idx
    let startNode: Text | null = null; //result starting node
    let startOffset = 0;  //result starting offset
    let endNode: Text | null = null; //result ending node
    let endOffset = 0; //result ending offset

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