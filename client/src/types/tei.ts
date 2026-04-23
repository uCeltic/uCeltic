export interface TEITextNode {
    type: "text";
    text: string;
}

export interface TEIElementNode {
    tag: string;
    attrs?: Record<string, string>;
    children?: (TEITextNode | TEIElementNode)[];
}

export type TEINode = TEIElementNode | TEITextNode;

export interface TEIMeta {
    title: string;
    author: string;
    language: string;
    pbCount: number;
}

export interface TEIDoc{
    id: number;
    title: string;
    language: string;
    parsedJson: TEINode;
    createdAt: string;
    meta: TEIMeta;

export interface TEICatalogEntry {
    id: number;
    title: string;
    language: string;
    createdAt: string;
}

}