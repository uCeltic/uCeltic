import type {TEINode, TEIElementNode} from "../types/tei";
import { elementMap } from "./elementMap";
import PassThrough from "./PassThrough";

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

