import { useMemo } from "react";
import type { TEINode, TEIElementNode } from "../types/tei";
import { elementMap } from "./elementMap";
import PassThrough from "./PassThrough";

// Render a TEI document.
// if the node is a text node, return the text.
// else, first render the children
// then find the corresponding component in the elementMap, and render it.
// example:
// {
//     "tag": "p",
//     "children": [
//       { "type": "text", "text": "Hello " },
//       { "tag": "note", "children": [...] }
//     ]
//   }

// result:
// {/* <P>
//   Hello
//   <Note>comment</Note>
//   world
// </P> */}

// Subtrees that are parsed and walked but never painted. `teiHeader` is
// catalogue metadata; `standOff` is what a document files *about* its text —
// the name authority list that used to fill the screen before the text began
// (#151), and today `serafin03.xml`'s 20 Polish transcription notes (#162).
// Apparatus either way, and both stay in `parsed_json`.
//
// Skipping happens at render only. `assignAnchorIds` below still walks into
// these subtrees, because the backend's `_flatten` allocates an id for every
// element and the two walks must stay in step or every later anchor shifts.
const SKIP_TAGS = new Set(["teiHeader", "standOff"]);



// What one pre-order pass over a document works out: where each element's
// anchor is, and which number each editorial note answers to (#154). The
// counters are part of it because they are what the maps are being filled from.
interface Numbering {
  ids: Map<TEINode, number>;
  noteNumbers: Map<TEINode, number>;
  // The `pb` whose next sibling element is a `cb` (#165). Adjacency is a fact
  // about a node's *place*, not about the node, so it is worked out here for the
  // same reason note numbers are: `Pb` is handed its own subtree and nothing else.
  followedByCb: Set<TEINode>;
  nextAnchor: number;
  nextNote: number;
}

/**
 * The next child after `i` that is an element, stepping over the whitespace a
 * pretty-printed file leaves between two tags.
 *
 * Whitespace only. Text that says something is text the `pb` locates and the
 * `cb` does not, so a `pb` in front of it keeps its locator: hiding it there
 * would drop the page the words in between are on.
 */
function nextElementSibling(children: TEINode[], i: number): TEIElementNode | null {
  for (let j = i + 1; j < children.length; j++) {
    const sib = children[j];
    if ("type" in sib && sib.type === "text") {
      if (sib.segments.some((s) => s.text.trim() !== "")) return null;
      continue;
    }
    return sib as TEIElementNode;
  }
  return null;
}

// pre-order DFS traversal to assign anchor ids to the nodes in the tei document
// skip the text nodes
// assign anchor ids to the element nodes
// continue the traversal until all the nodes have been visited
//
// The same walk numbers the notes, because a note's place in a pre-order walk IS
// its place in the document (#154). The two counters run on different rules:
// every element takes an anchor id, including the ones inside `SKIP_TAGS`, so
// this walk stays in step with the backend's `_flatten`; a note takes a number
// only if it is outside them. `teiHeader` carries notes of its own — catalogue
// metadata the reader never sees, 8 of the 28 in one research file — and letting
// those count would start the first visible note somewhere in the middle.
//
// `SKIP_TAGS` is the whole of the rule, which is the same rule `NodeRenderer`
// renders by, so the two cannot disagree about which notes are on screen.
function walkDocument(node: TEINode, state: Numbering, insideSkipped: boolean) {
  if ("type" in node && node.type === "text") return;
  const el = node as TEIElementNode;
  state.ids.set(node, state.nextAnchor++);

  const skipped = insideSkipped || SKIP_TAGS.has(el.tag);
  if (!skipped && el.tag === "note") state.noteNumbers.set(node, state.nextNote++);

  const children = el.children ?? [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!("type" in child) && child.tag === "pb" && nextElementSibling(children, i)?.tag === "cb") {
      state.followedByCb.add(child);
    }
    walkDocument(child, state, skipped);
  }
}

interface Props {
  node: TEINode;
}


export default function TEIRenderer({ node }: Props) {
  // Numbering is per renderer, and the renderer is instantiated once per
  // document, so two manuscripts side by side each number from 1 without
  // knowing about each other.
  const numbering = useMemo(() => {
    const state: Numbering = {
      ids: new Map(),
      noteNumbers: new Map(),
      followedByCb: new Set(),
      nextAnchor: 0,
      nextNote: 1,
    };
    walkDocument(node, state, false);
    return state;
  }, [node]);
  return <NodeRenderer node={node} numbering={numbering} />;
}

//Second DFS traversal to render the tei document
function NodeRenderer({ node, numbering }: { node: TEINode; numbering: Numbering }) {
  if ("type" in node && node.type === "text") {
    return <>{node.segments.map((s) => s.text).join("")}</>;
  }
  const el = node as TEIElementNode;
  if (SKIP_TAGS.has(el.tag)) return null;

  const anchorId = numbering.ids.get(node) ?? -1;
  const children = (el.children ?? []).map((child, i) => (
    <NodeRenderer key={i} node={child} numbering={numbering} />
  ));
  const Component = elementMap[el.tag] ?? PassThrough;
  return (
    <Component
      node={el}
      anchorId={anchorId}
      noteNumber={numbering.noteNumbers.get(node)}
      followedByCb={numbering.followedByCb.has(node)}
    >
      {children}
    </Component>
  );
}