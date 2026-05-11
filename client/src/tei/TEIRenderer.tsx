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

interface AnchorContext {
  nextId: () => number;
}

function makeAnchorContext(): AnchorContext {
  let id = 0;
  return { nextId: () => id++ };
}

interface Props {
  node: TEINode;
  ctx?: AnchorContext;
}

export default function TEIRenderer({ node, ctx }: Props) {
  const context = ctx ?? makeAnchorContext();
  return <NodeRenderer node={node} ctx={context} />;
}

function NodeRenderer({ node, ctx }: { node: TEINode; ctx: AnchorContext }) {
  if ("type" in node && node.type === "text") {
    return <>{node.text}</>;
  }
  const el = node as TEIElementNode;
  if (SKIP_TAGS.has(el.tag)) return null;

  const anchorId = ctx.nextId();
  const children = (el.children ?? []).map((child, i) => (
    <NodeRenderer key={i} node={child} ctx={ctx} />
  ));
  const Component = elementMap[el.tag] ?? PassThrough;
  return (
    <Component node={el} anchorId={anchorId}>
      {children}
    </Component>
  );
}
