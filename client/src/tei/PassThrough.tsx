import type { TEIElementNode } from "../types/tei";

interface props {
    node: TEIElementNode;
    children: React.ReactNode;
}

export default function PassThrough({ node, children }: props) {
    return <span data-tei-tag={node.tag}>{children}</span>;
}