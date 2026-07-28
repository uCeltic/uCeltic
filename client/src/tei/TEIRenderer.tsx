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



// pre-order DFS traversal to assign anchor ids to the nodes in the tei document
// skip the teiHeader tag
// skip the text nodes
// assign anchor ids to the element nodes
// continue the traversal until all the nodes have been visited
function assignAnchorIds(node: TEINode, ids: Map<TEINode, number>, counter: { n: number }) {
  if ("type" in node && node.type === "text") return;
  const el = node as TEIElementNode;
  ids.set(node, counter.n++);
  for (const child of el.children ?? []) {
    assignAnchorIds(child, ids, counter);
  }
}

interface Props {
  node: TEINode;
}


export default function TEIRenderer({ node }: Props) {
  const ids = useMemo(() => {
    const map = new Map<TEINode, number>();
    assignAnchorIds(node, map, { n: 0 });
    return map;
  }, [node]);
  return <NodeRenderer node={node} ids={ids} />;
}

//Second DFS traversal to render the tei document
function NodeRenderer({ node, ids }: { node: TEINode; ids: Map<TEINode, number> }) {
  if ("type" in node && node.type === "text") {
    return <>{node.segments.map((s) => s.text).join("")}</>;
  }
  const el = node as TEIElementNode;
  if (SKIP_TAGS.has(el.tag)) return null;

  const anchorId = ids.get(node) ?? -1;
  const children = (el.children ?? []).map((child, i) => (
    <NodeRenderer key={i} node={child} ids={ids} />
  ));
  const Component = elementMap[el.tag] ?? PassThrough;
  return (
    <Component node={el} anchorId={anchorId}>
      {children}
    </Component>
  );
}