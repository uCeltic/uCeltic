"""Parse TEI XML into three artifacts:
- parsed_json:  TEI tree for React rendering (text nodes carry segments)
- anchors:      contains info for each anchor element/tag element
- word_array:   flat list of words for search (each carries its anchor_id)

Tokenisation runs on a flattened character stream, not on one text node at a
time. Editorial TEI marks up *inside* words — `tal<expan>am</expan>` records an
expanded scribal abbreviation, and is the single most common shape in real
manuscript files — so an element boundary is not a word boundary. Splitting
per text node shattered `talam` into `tal` and `am`, and search could never
match it again (#145).

The flat stream is built in one walk, tokenised in one pass, and the results are
written back into both the render tree and the index. A word may therefore span
several anchors, and each anchor records the character range the word occupies
inside its own text.
"""
import re
from typing import NamedTuple

from lxml import etree

# Subtrees whose text stays on screen but leaves the search index. `note` holds
# the editor's English commentary, not manuscript text, so a fuzzy match window
# must not be able to straddle the boundary between the two.
SKIP_TAGS = {"teiHeader", "note"}

_TOKEN_RE = re.compile(r"(\w+|[^\w]+)", re.UNICODE)

# get the tag name without the namespace
def _strip_ns(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag

# True for real elements only. lxml gives comments and processing instructions
# the callable that constructs them (etree.Comment, etree.ProcessingInstruction)
# as their .tag, rather than a string.
def _is_element(el) -> bool:
    return isinstance(el.tag, str)


# pipeline: parse the tei xml into parsed_json, anchors and word array
def parse_tei(xml_bytes: bytes) -> tuple[dict, list[dict], list[dict]]:
    #root is lxml object
    root = etree.fromstring(xml_bytes)
    tag = _strip_ns(root.tag)
    if tag not in ("TEI", "teiCorpus"):
        raise ValueError(f"Root element must be TEI or teiCorpus, got: {tag}")

    stream = _Stream()
    parsed_json = _flatten(root, stream)
    word_array = _tokenise(stream)
    return parsed_json, stream.anchors, word_array


class _Stream:
    """One document's flattened text, plus the bookkeeping to write results back.

    `text` is every character of the document in reading order. A `run` is one
    contiguous piece of that stream belonging to a single anchor — an element's
    own `el.text`, or the `tail` that follows one of its children. Runs are the
    bridge between the two coordinate systems in play: positions in the flat
    stream, which is where words are decided, and positions inside one anchor's
    own text, which is what the frontend can find in the DOM.
    """

    def __init__(self):
        self.anchors: list[dict] = []
        self.runs: list[dict] = []
        self._parts: list[str] = []
        self._length = 0
        self._next_anchor_id = 0
        self._line_counter = 0

    def new_anchor(self, tag: str, attrs: dict) -> dict:
        anchor = {
            "id": self._next_anchor_id,
            "tag": tag,
            "attrs": attrs,
            "line_no": self._line_no(tag, attrs),
            "word_char_offsets": [],
        }
        self._next_anchor_id += 1
        self.anchors.append(anchor)
        return anchor

    # Verse lines carry their manuscript number when the editor supplied one,
    # and a running count when they did not.
    def _line_no(self, tag: str, attrs: dict) -> str | None:
        if tag != "l":
            return None
        if attrs.get("n") is not None:
            return attrs["n"]
        self._line_counter += 1
        return str(self._line_counter)

    def add_run(self, text: str, anchor: dict, char_pos: int, skip: bool) -> dict:
        """Append one piece of text to the stream, and return its render node.

        The node's `segments` list is handed out empty and filled during
        tokenisation, once the stream is complete enough to say where the words
        are. `char_pos` is where this piece starts inside the anchor's own text.
        """
        run = {
            "anchor": anchor,
            "char_pos": char_pos,
            "skip": skip,
            "start": self._length,
            "end": self._length + len(text),
            "segments": [],
        }
        self._parts.append(text)
        self._length += len(text)
        self.runs.append(run)
        return {"type": "text", "segments": run["segments"]}

    def flat(self) -> str:
        return "".join(self._parts)


# Walk the tree once: allocate every anchor, append every character to the flat
# stream, and build the render tree around the text nodes the stream hands back.
def _flatten(el, stream: _Stream, in_skip: bool = False):
    # Drop before an anchor id is allocated, so backend _flatten and frontend
    # assignAnchorIds keep traversing the same node set — otherwise every
    # anchor after the first comment shifts and highlighting lands on the
    # wrong line. The caller still streams the tail, so no text is lost.
    if not _is_element(el):
        return None

    tag = _strip_ns(el.tag)
    skip = in_skip or tag in SKIP_TAGS

    attrs = {_strip_ns(k): v for k, v in el.attrib.items()}
    anchor = stream.new_anchor(tag, attrs)

    children = []
    # Where the next piece of this element's own text starts. Child subtrees do
    # not advance it: an anchor's coordinates cover only the text nodes that are
    # its direct children, which is exactly what the frontend TreeWalker sees.
    char_pos = 0

    # Whitespace-only text is text. Dropping it glued words together in the
    # reading pane (`fīarfaigEochaid`) and starved the index of the separators
    # that make a result snippet readable.
    if el.text:
        children.append(stream.add_run(el.text, anchor, char_pos, skip))
        char_pos += len(el.text)

    for child in el:
        sub = _flatten(child, stream, skip)
        if sub is not None:
            children.append(sub)
        if child.tail:
            children.append(stream.add_run(child.tail, anchor, char_pos, skip))
            char_pos += len(child.tail)

    node = {"tag": tag}
    if attrs:
        node["attrs"] = attrs
    if children:
        node["children"] = children
    return node


# Tokenise the finished stream, filling in the render tree's segments, the
# anchors' word_char_offsets and the word array.
def _tokenise(stream: _Stream) -> list[dict]:
    flat = stream.flat()
    word_array: list[dict] = []

    for runs in _islands(stream.runs):
        _tokenise_island(flat, runs, word_array)

    return word_array


# Split the runs into maximal stretches that are either all indexed or all
# skipped. Tokenising each stretch on its own is what keeps a word from
# spanning the edge of a skipped subtree: `d’illrechtaib<note>Dot over b.</note>`
# flattens to `d’illrechtaibDot over b.`, and without a hard boundary the regex
# reads `illrechtaibDot` as one word. It also splits a separator chunk that
# straddles the edge, so the note's full stop cannot leak into the separator of
# the word before it.
def _islands(runs: list[dict]) -> list[list[dict]]:
    islands: list[list[dict]] = []
    for run in runs:
        if islands and islands[-1][-1]["skip"] == run["skip"]:
            islands[-1].append(run)
        else:
            islands.append([run])
    return islands


class _Piece(NamedTuple):
    """As much of one token as fell inside a single run.

    A token that inline markup interrupts arrives here in several pieces, each
    already translated out of flat-stream coordinates and into the coordinates
    of the anchor that owns it.
    """

    anchor: dict
    segments: list      # the render tree's text node for this piece's run
    char_start: int     # against the anchor's own text, not the flat stream
    char_end: int
    text: str


def _tokenise_island(flat: str, runs: list[dict], word_array: list[dict]) -> None:
    skip = runs[0]["skip"]
    start, end = runs[0]["start"], runs[-1]["end"]
    cursor = 0

    for match in _TOKEN_RE.finditer(flat, start, end):
        chunk = match.group(0)
        pieces, cursor = _pieces(flat, runs, cursor, match.start(), match.end())

        # Skipped text still renders, so it still needs segments — it just has
        # no words in it as far as search is concerned.
        if skip or not chunk[0].isalnum():
            for piece in pieces:
                piece.segments.append({"kind": "sep", "text": piece.text})
            if not skip and word_array:
                # Accumulate: the punctuation closing one element and the
                # punctuation opening the next both belong to the word before
                # them, and the old tokenizer let the second erase the first.
                word_array[-1]["sep"] += chunk
            continue

        idx = len(word_array)
        word_array.append({"w": chunk, "a": pieces[0].anchor["id"], "sep": ""})

        # One segment per run, because each run is its own text node in the
        # render tree; one offset entry per anchor, because that is what the
        # frontend resolves into a DOM range.
        for piece in pieces:
            piece.segments.append({"kind": "word", "text": piece.text, "idx": idx})
        for anchor, char_start, char_end in _offsets(pieces):
            anchor["word_char_offsets"].append([idx, char_start, char_end])


# Cut a flat range into the runs it covers, translating each piece into the
# owning anchor's own coordinates. Matches arrive in stream order, so `cursor`
# only ever moves forward.
def _pieces(
    flat: str, runs: list[dict], cursor: int, start: int, end: int
) -> tuple[list[_Piece], int]:
    while cursor < len(runs) and runs[cursor]["end"] <= start:
        cursor += 1

    pieces = []
    i = cursor
    while i < len(runs) and runs[i]["start"] < end:
        run = runs[i]
        piece_start = max(start, run["start"])
        piece_end = min(end, run["end"])
        if piece_end > piece_start:
            # Where this run's text sits in the anchor, minus where it sits in
            # the stream: add it to a flat position to get an anchor position.
            offset = run["char_pos"] - run["start"]
            pieces.append(_Piece(
                anchor=run["anchor"],
                segments=run["segments"],
                char_start=piece_start + offset,
                char_end=piece_end + offset,
                text=flat[piece_start:piece_end],
            ))
        i += 1
    return pieces, cursor


# Fold a word's pieces down to one entry per anchor, in first-appearance order.
#
# A word re-enters the anchor it started in every time an inline element
# interrupts it, and `a<expan>n</expan>n<expan>si</expan>n` interrupts it twice.
# Those returns are always contiguous in the anchor's own coordinates — child
# subtrees do not advance them — so however many times the word leaves and comes
# back, it occupies one unbroken character range there.
def _offsets(pieces: list[_Piece]) -> list[tuple]:
    spans: dict[int, list] = {}
    for piece in pieces:
        span = spans.get(piece.anchor["id"])
        if span is None:
            spans[piece.anchor["id"]] = [piece.anchor, piece.char_start, piece.char_end]
        else:
            span[2] = piece.char_end
    return [tuple(span) for span in spans.values()]
