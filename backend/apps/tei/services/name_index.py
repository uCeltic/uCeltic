"""One document's own account of the names it marks up (#163).

`@nymRef` is the only thing in this corpus that says "these spellings are one
person". It has to be: the four witnesses spell the same man `Find`, `Fionn`,
`Find` and `Finn`, so searching one will never reach another, and following an
entity across the columns is the whole reason they sit side by side.

What the corpus does *not* carry is a name for a group. `F64` appears 64 times
across the four files and no file ever says who `F64` is. That is
`name_registry`'s job; this module only reports what one document says, as it
says it:

    {"F64": {"count": 21,
             "types": {"person": 21},
             "variants": {"Find": 17, "Find mac Cumaill meic Trēnmóir": 2, …},
             "anchors": [143, 287, …]},
     "e6":  {…}}

The tally is deliberately raw. `types` is kept rather than a resolved
person/place because the corpus-wide answer is a majority over *occurrences* —
`e6` is tagged `place` 113 times and `person` once — and a per-document verdict
would let a document with one occurrence outvote one with thirty. `variants`
keeps every spelling with its count for the same reason: the headword is chosen
from them once, by whichever document introduces the code.

Insertion order carries meaning. `variants` is written in the order the
spellings are first met, which is how a tie between two equally frequent
spellings is broken (`headword_of`), and JSON preserves it.
"""
from typing import TypedDict

from lxml import etree

from .parse import SKIP_TAGS, anchor_elements, strip_ns

# The elements that can carry a group id, matching the frontend's ENTITY_TAGS
# (`client/src/tei/entityElements.ts`). The two sets have to agree: this one
# decides the count a menu row prints, that one decides which spans the
# highlighter can find, and `21 occurrences` next to 19 highlighted ones is not
# a claim about anything. Pinned across the two languages by
# `test_name_index.NameTagsMatchTheRendererTest`.
#
# The corpus in hand only ever uses `name` and `addName`; the rest are here
# because the app consumes TEI it did not author and the renderer already draws
# them.
NAME_TAGS = frozenset({
    "persName", "placeName", "geogName", "orgName", "rs", "name", "addName",
})

PERSON = "person"
PLACE = "place"
KINDS = (PERSON, PLACE)


class NameIndexEntry(TypedDict):
    """What one document says about one group of its names.

    A plain dict at runtime, because it is stored as JSON on the document and
    read back by both the register and the frontend; the annotation is here so
    the shape has one written definition on this side, the way
    `TEINameIndexEntry` gives it one on the other.
    """

    #: How many occurrences this document has, including untyped ones.
    count: int
    #: How often each `@type` was used. Un-resolved on purpose: the corpus-wide
    #: kind is a majority over occurrences, so a per-document verdict would let
    #: a one-occurrence document outvote a thirty-occurrence one.
    types: dict[str, int]
    #: Every spelling, with its count, in the order the spellings are first met
    #: — which is how `headword_of` breaks a tie.
    variants: dict[str, int]
    #: The anchor of each occurrence, in reading order.
    anchors: list[int]


def build_name_index(xml_bytes: bytes) -> dict[str, NameIndexEntry]:
    """Group this document's named entities by the id their markup gives them.

    There is no lookup table, so there is no "not found": an id nobody else uses
    is simply a group of one. Lismore writes `nymRef="64"` once where it means
    `F64`, and that typo becomes its own group — two near-identical menu rows
    are the signal to fix the source file, where a correction table in the app
    would hide the defect and never be removed.
    """
    root = etree.fromstring(xml_bytes)
    index: dict[str, NameIndexEntry] = {}

    for anchor_id, el in enumerate(anchor_elements(root)):
        # `@nymRef` and nothing else. Six names put the group id in `@n`
        # instead, and `@n` is a different TEI attribute with a real meaning —
        # reading it would invent a grouping the corpus never claimed, so those
        # names stay ungrouped: visible in the text, absent from the menu.
        code = el.get("nymRef")
        if code is None or strip_ns(el.tag) not in NAME_TAGS:
            continue
        if _is_apparatus(el):
            continue

        entry: NameIndexEntry = index.setdefault(
            code, {"count": 0, "types": {}, "variants": {}, "anchors": []}
        )
        entry["count"] += 1
        entry["anchors"].append(anchor_id)

        kind = el.get("type")
        if kind:
            entry["types"][kind] = entry["types"].get(kind, 0) + 1

        # A group whose spellings are all empty gets no menu row, so an empty
        # form is not worth a variant of its own.
        form = surface_form(el)
        if form:
            entry["variants"][form] = entry["variants"].get(form, 0) + 1

    return index


def surface_form(el) -> str:
    """The spelling this occurrence writes the name with.

    Nested `note` text is not part of it. Lismore writes
    `Trēnmhōr<note><p>Dúch caite</p></note> ūa Baīscne`, and taking the
    element's whole text would print the palaeographer's remark in the Tag
    Filter menu. This is the same manuscript-text/commentary boundary `note`
    already draws for the search index — the excluded subtree's *tail* is still
    the name, though, because that occurrence's surname follows the note and is
    as much the manuscript's text as the given name before it.

    Inline markup inside the name is the name: `tal<expan>am</expan>` records an
    expanded scribal abbreviation, not two spellings.
    """
    return " ".join("".join(_text_pieces(el, top=True)).split())


def _text_pieces(el, top: bool = False):
    if not top and strip_ns(el.tag) in SKIP_TAGS:
        # The subtree goes, its tail stays — the tail is the parent's text.
        return [el.tail] if el.tail else []

    pieces = [el.text] if el.text else []
    for child in el:
        if isinstance(child.tag, str):
            pieces += _text_pieces(child)
        elif child.tail:
            # A comment or processing instruction contributes no text of its
            # own, but the text after it is still the name's.
            pieces.append(child.tail)
    if not top and el.tail:
        pieces.append(el.tail)
    return pieces


def kind_of(types: dict[str, int]) -> str:
    """Whether a group is a person or a place: whatever it was tagged most often.

    `e6` is tagged `place` 113 times and `person` once, and it is a place. The
    minority tag is a slip in the research files, not a second identity.

    A group the corpus never typed at all reads as a person. No group in the
    corpus in hand is untyped throughout, so this is a degradation rule rather
    than a claim about the text: TEI's unqualified `name` is most often a
    personal name, and a row under the wrong heading is recoverable where a row
    under no heading is invisible. A tie resolves the same way.
    """
    return max(KINDS, key=lambda kind: (types.get(kind, 0), kind == PERSON))


def headword_of(variants: dict[str, int]) -> str | None:
    """What the menu should print for a group: its most frequent spelling.

    Ties go to whichever was met first, which `variants` records as its
    insertion order. `None` when the group has nothing printable — every one of
    its occurrences was empty — and such a group gets no menu row at all.
    """
    if not variants:
        return None
    return max(variants, key=lambda form: variants[form])


def _is_apparatus(el) -> bool:
    """True for a name inside a subtree that is not the manuscript's text.

    The editors name themselves in `teiHeader` and cite scholars in `note`; both
    are already out of the search index for the same reason, and neither is a
    name the reader can follow through the columns.
    """
    return any(
        strip_ns(ancestor.tag) in SKIP_TAGS
        for ancestor in el.iterancestors()
        if isinstance(ancestor.tag, str)
    )
