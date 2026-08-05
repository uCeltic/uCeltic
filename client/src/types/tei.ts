// Type definitions for TEI data used by the frontend.
// These types describe the JSON shape returned by the backend TEI API.

// text segment is a word or a separator, idx is the index of the word in the
// document. A word that inline markup splits (`tal<expan>am</expan>`) leaves one
// segment in each element it passes through, so `text` may be a fragment and the
// same `idx` may appear in several segments.
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
// Offsets are against the element's OWN text — the text nodes that are its direct
// children, with child subtrees skipped over — which is what a TreeWalker
// restricted to direct children sees in the DOM.
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
  a: number; // anchor_id the word STARTS in; it may run on into others
  sep: string;
}

// The named story a document is one witness of — a container, holding no text
// itself. Stated by the database (`apps.tei.Work`), never parsed out of the
// document title. `null` on a document nobody has assigned to a work yet; such
// a document is still openable.
export interface TEIWork {
  id: number;
  name: string;
  slug: string;
}

// One document's account of one entity it names, keyed in `name_index` by the
// `@nymRef` group id every occurrence of it carries (#163).
//
// The counts are this document's own: `Find` is written 21 times in Franciscan
// A 4 and 10 in G 126, and the Tag Filter prints one per visible column. The
// register (`NameEntity`) says what the id NAMES; this says how often this
// column says it, and the menu is the join of the two.
export interface TEINameIndexEntry {
  count: number;
  /** How often each `@type` was used, un-resolved — the corpus-wide kind is a
   *  majority over occurrences, so the tally has to survive the trip. */
  types: Record<string, number>;
  /** Every spelling this document writes the name with, and how often. */
  variants: Record<string, number>;
  /** The anchor of each occurrence, in reading order. */
  anchors: number[];
}

/** `null` on a document parsed before the registry existed (#163). */
export type TEINameIndex = Record<string, TEINameIndexEntry> | null;

// Whether an Entity Grouping is a person or a place: the majority `@type` over
// every occurrence in the corpus, decided on the backend (CONTEXT.md → Kind).
export type EntityKind = "person" | "place";

// One entry of the corpus-wide name register — what a `@nymRef` group id is
// called, which no TEI file in the corpus says (#163).
export interface NameEntity {
  /** The `@nymRef` value verbatim, case and all: `A13` is a man, `a13` a hillfort. */
  code: string;
  kind: EntityKind;
  /** What the Tag Filter prints. Derived from the corpus's own spellings until
   *  a human overrides it in admin. */
  headword: string;
}

//detail info for each tei document
export interface TEIDoc {
  id: number;
  title: string;
  language: string;
  work: TEIWork | null;
  parsed_json: TEINode;
  created_at: string;
  meta: TEIMeta;
  anchors: TEIAnchor[];
  word_array: TEIWordEntry[];
  name_index: TEINameIndex;
}

// list all the tei documents in the database
export interface TEICatalogEntry {
  id: number;
  title: string;
  language: string;
  work: TEIWork | null;
  created_at: string;
}
