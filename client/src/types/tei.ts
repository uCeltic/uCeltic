// Type definitions for TEI data used by the frontend.
// These types describe the JSON shape returned by the backend TEI API.

// text segment is a word or a separator, idx is the index of the words in the text
export type TEITextSegment =
  | { kind: "word"; text: string; idx: number }
  | { kind: "sep"; text: string };

// text node  from the tei parse tree
export interface TEITextNode {
  type: "text";
  segments: TEITextSegment[];
}

// element node from the tei parse tree
export interface TEIElementNode {
  tag: string;
  attrs?: Record<string, string>;
  children?: (TEITextNode | TEIElementNode)[];
}

export type TEINode = TEIElementNode | TEITextNode;

// meta data for the tei document
export interface TEIMeta {
  title: string;
  author: string;
  language: string;
  pbCount: number;
}


// Anchor is a backend-generated "map location" in the TEI document.
// Its id locates rendered TEI tags; word_char_offsets support result highlighting.
export interface TEIAnchor {
  id: number;
  tag: string;
  attrs?: Record<string, string>;
  line_no?: string | null;
  word_char_offsets: [number, number, number][]; // [word_idx, char_start, char_end]
}

//word arry from the backend
export interface TEIWordEntry {
  w: string;
  a: number; // anchor_id
  sep: string;
}

//detail info for each tei document
export interface TEIDoc {
  id: number;
  title: string;
  language: string;
  parsed_json: TEINode;
  created_at: string;
  meta: TEIMeta;
  anchors: TEIAnchor[]; 
  word_array: TEIWordEntry[]; 
}

// list all the tei documents in the database
export interface TEICatalogEntry {
  id: number;
  title: string;
  language: string;
  created_at: string;
}
