import type {TEINode, TEIElementNode} from "../types/tei";
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


interface props {
    node: TEINode;
}

export default function TEIRenderer({ node }: props) {
    if ("type" in node && node.type === "text") {
        return <> {node.text} </>;
    }
    const el = node as TEIElementNode;
    const children = (el.children ?? []).map((child, i) => (
        <TEIRenderer key={i} node={child} />
    ));
    const Component = elementMap[el.tag] ?? PassThrough;
    return <Component node={el}>{children}</Component>;
}

