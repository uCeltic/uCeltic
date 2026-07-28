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
// catalogue metadata; `standOff` is the name authority list — 33 people and 10
// places with every spelling variant of each, which used to fill the screen
// before the text began (#151). Both stay in `parsed_json`: the Tag Filter
// reads the authority list from there (#147).
//
// Skipping happens at render only. `assignAnchorIds` below still walks into
// these subtrees, because the backend's `_flatten` allocates an id for every
// element and the two walks must stay in step or every later anchor shifts.
const SKIP_TAGS = new Set(["teiHeader", "standOff"]);



// What one pre-order pass over a document works out: where each element's
// anchor is, and which number each editorial note answers to (#154).
interface Numbering {
  ids: Map<TEINode, number>;
  noteNumbers: Map<TEINode, number>;
}

// pre-order DFS traversal to assign anchor ids to the nodes in the tei document
// skip the text nodes
// assign anchor ids to the element nodes
// continue the traversal until all the nodes have been visited
//
// The same walk numbers the notes, because a note's place in a pre-order walk IS
// its place in the document (#154). The two counters run on different rules:
// every element takes an anchor id, including the ones inside `SKIP_TAGS`, so
// this walk stays in step with the backend's `_flatten`; only notes that reach
// the screen take a number. `teiHeader` carries notes of its own — catalogue
// metadata the reader never sees — and letting those count would start the
// first visible note somewhere in the middle.
function walkDocument(
  node: TEINode,
  out: Numbering,
  counter: { anchor: number; note: number },
  painted: boolean,
) {
  if ("type" in node && node.type === "text") return;
  const el = node as TEIElementNode;
  out.ids.set(node, counter.anchor++);

  const childrenPainted = painted && !SKIP_TAGS.has(el.tag);
  if (childrenPainted && el.tag === "note") out.noteNumbers.set(node, counter.note++);

  for (const child of el.children ?? []) {
    walkDocument(child, out, counter, childrenPainted);
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
    const out: Numbering = { ids: new Map(), noteNumbers: new Map() };
    walkDocument(node, out, { anchor: 0, note: 1 }, true);
    return out;
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
    <Component node={el} anchorId={anchorId} noteNumber={numbering.noteNumbers.get(node)}>
      {children}
    </Component>
  );
}