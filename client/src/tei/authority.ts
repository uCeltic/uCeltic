import type { TEIElementNode, TEINode } from "../types/tei";

/**
 * The name authority list a TEI document declares about itself.
 *
 * The Acallam manuscripts each carry a `standOff` naming 33 people and 10
 * places, every entry listing a canonical headword and up to 13 spelling
 * variants, and every named entity in the body points back at one with
 * `ref="#fionn"`. That is the grouping the Tag Filter needs — "Find, Finn,
 * Ḟinn and Fhionn are one man" is answered by the corpus, not by us — and the
 * ids are identical across the three manuscripts, so one selected person
 * resolves in every open column at once.
 *
 * Everything here is derived from the documents in hand. Nothing is hard-coded:
 * that is what keeps "no option is offered that cannot match anything" true by
 * construction rather than by vigilance, which is the mistake the element-name
 * vocabulary this module replaces made twice over (#147).
 */

export type EntityKind = "person" | "place";

export interface AuthorityEntry {
  /** The entry's `xml:id`, without the `#` a body reference prefixes it with. */
  id: string;
  kind: EntityKind;
  /** The `type="canonical"` name — what the reader is shown. */
  headword: string;
  /** The `type="variant"` names, in document order. */
  variants: string[];
}

export interface EntityMenuEntry extends AuthorityEntry {
  /** Occurrences in each source document, in the order they were given. */
  counts: number[];
  total: number;
}

// `xml:id` does not survive as `xml:id`: parse.py strips the namespace off
// every attribute name, so the id arrives as plain `id`. A body reference does
// keep its `#`.
const ID_ATTR = "id";
const REF_PREFIX = "#";

// Which list holds which kind, and what a headword element is called inside it.
const LISTS: Record<string, { kind: EntityKind; entry: string; name: string }> =
  {
    listPerson: { kind: "person", entry: "person", name: "persName" },
    listPlace: { kind: "place", entry: "place", name: "placeName" },
  };

function isElement(node: TEINode): node is TEIElementNode {
  return !("type" in node);
}

function children(node: TEINode): TEINode[] {
  return isElement(node) ? (node.children ?? []) : [];
}

/** Every element in the subtree, in document order, the root included. */
function* elements(node: TEINode): Generator<TEIElementNode> {
  if (isElement(node)) yield node;
  for (const child of children(node)) yield* elements(child);
}

/** The rendered text of a subtree, whitespace collapsed the way a browser does. */
function textOf(node: TEINode): string {
  if (!isElement(node)) return node.segments.map((s) => s.text).join("");
  return children(node).map(textOf).join("");
}

function headwordText(node: TEINode): string {
  return textOf(node).replace(/\s+/g, " ").trim();
}

function firstDescendant(node: TEINode, tag: string): TEIElementNode | undefined {
  for (const el of elements(node)) if (el.tag === tag) return el;
  return undefined;
}

function readEntry(
  el: TEIElementNode,
  spec: { kind: EntityKind; name: string },
): AuthorityEntry | undefined {
  const id = el.attrs?.[ID_ATTR];
  // An entry nothing can point at cannot be selected, counted or highlighted,
  // so it is not an option.
  if (!id) return undefined;

  const names = children(el).filter(
    (c): c is TEIElementNode => isElement(c) && c.tag === spec.name,
  );
  // Which name is the headword is stated by the attribute, not by position —
  // the corpus does put a variant first in places.
  const canonical = names.find((n) => n.attrs?.type === "canonical");
  const headword = headwordText(canonical ?? names[0] ?? el);
  if (!headword) return undefined;

  return {
    id,
    kind: spec.kind,
    headword,
    variants: names
      .filter((n) => n !== canonical)
      .map(headwordText)
      .filter(Boolean),
  };
}

/**
 * The authority entries one document declares, people first, then places, each
 * in document order. A document with no `standOff` declares none.
 */
export function readAuthorityList(root: TEINode): AuthorityEntry[] {
  const standOff = firstDescendant(root, "standOff");
  if (!standOff) return [];

  const entries: AuthorityEntry[] = [];
  for (const [listTag, spec] of Object.entries(LISTS)) {
    for (const list of elements(standOff)) {
      if (list.tag !== listTag) continue;
      for (const child of children(list)) {
        if (!isElement(child) || child.tag !== spec.entry) continue;
        const entry = readEntry(child, spec);
        if (entry) entries.push(entry);
      }
    }
  }
  return entries;
}

/**
 * How often each declared entity is referenced, counted in `<text>` alone.
 *
 * The authority list is full of `persName` elements of its own — 133 of
 * Franciscan A 4's 486 — and counting those would make every number wrong. The
 * search index excludes the same subtree (#151); this counts the other side of
 * that boundary, and both leave `standOff` out.
 *
 * References to ids the document never declared are dropped rather than
 * invented: the menu only offers what the authority list defines.
 */
export function countOccurrencesByEntity(root: TEINode): Record<string, number> {
  const declared = new Set(readAuthorityList(root).map((e) => e.id));
  const counts: Record<string, number> = {};

  const text = firstDescendant(root, "text");
  if (!text) return counts;

  for (const el of elements(text)) {
    const ref = el.attrs?.ref;
    if (!ref?.startsWith(REF_PREFIX)) continue;
    const id = ref.slice(REF_PREFIX.length);
    if (!declared.has(id)) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/**
 * The Tag Filter's menu for a given set of documents: the union of their
 * authority entries, deduplicated by id, each carrying one occurrence count per
 * document in the order supplied.
 *
 * Taking the documents as an argument is the seam #152 needs — choosing a work
 * in the opener will narrow the set passed in, rather than rewrite this menu.
 *
 * An entry absent from one document reads as `0` rather than disappearing,
 * which turns "which manuscript dwells on Fionn?" into something answerable at
 * a glance. Entries are ordered by total occurrences so the names the corpus
 * dwells on lead; the cost is that the order shifts as columns open and close,
 * which is the trade the counts are worth.
 */
export function buildEntityMenu(roots: TEINode[]): EntityMenuEntry[] {
  const byId = new Map<string, EntityMenuEntry>();
  const countsPerDoc = roots.map(countOccurrencesByEntity);

  roots.forEach((root, docIndex) => {
    for (const entry of readAuthorityList(root)) {
      let menuEntry = byId.get(entry.id);
      if (!menuEntry) {
        menuEntry = { ...entry, counts: roots.map(() => 0), total: 0 };
        byId.set(entry.id, menuEntry);
      }
      menuEntry.counts[docIndex] = countsPerDoc[docIndex][entry.id] ?? 0;
    }
  });

  const entries = [...byId.values()];
  for (const entry of entries) {
    entry.total = entry.counts.reduce((sum, n) => sum + n, 0);
  }
  entries.sort(
    (a, b) => b.total - a.total || a.headword.localeCompare(b.headword),
  );
  return entries;
}
