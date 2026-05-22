export type TEITextSegment =
  | { kind: "word"; text: string; idx: number }
  | { kind: "sep"; text: string };

export interface TEITextNode {
  type: "text";
  segments: TEITextSegment[];
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

export interface TEIAnchor {
  id: number;
  tag: string;
  parent_id: number | null;
  attrs?: Record<string, string>;
  line_no?: string | null;
  word_char_offsets: [number, number, number][]; // [word_idx, char_start, char_end]
}

export interface TEIWordEntry {
  w: string;
  a: number; // anchor_id of innermost containing element
  sep: string;
}

export interface TEIDoc {
  id: number;
  title: string;
  language: string;
  parsed_json: TEINode;
  created_at: string;
  meta: TEIMeta;
  anchors: TEIAnchor[]; // NEW
  word_array: TEIWordEntry[]; // NEW
}

export interface TEICatalogEntry {
  id: number;
  title: string;
  language: string;
  created_at: string;
}
