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

const SKIP_TAGS = new Set(["teiHeader"]);

// Pre-compute anchor IDs in a single pre-order DFS pass so the numbering is
// pure data (immune to React's StrictMode double-rendering) and matches the
// backend's extract_text_and_anchors traversal exactly.
function assignAnchorIds(node: TEINode, ids: Map<TEINode, number>, counter: { n: number }) {
  if ("type" in node && node.type === "text") return;
  const el = node as TEIElementNode;
  if (SKIP_TAGS.has(el.tag)) return;
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

function NodeRenderer({ node, ids }: { node: TEINode; ids: Map<TEINode, number> }) {
  if ("type" in node && node.type === "text") {
    return <>{node.text}</>;
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
