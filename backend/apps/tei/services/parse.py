"""Parse TEI XML into three artifacts in one pass:
- parsed_json:  TEI tree for React rendering (text nodes carry segments)
- anchors:      contains info for each anchor element/tag element
- word_array:   flat list of words for search (each carries its anchor_id)
"""
import re
from lxml import etree

SKIP_TAGS = {"teiHeader"}

_WORD_RE = re.compile(r"(\w+|[^\w]+)", re.UNICODE)

# get the tag name without the namespace
def _strip_ns(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag

# pipeline: parse the tei xml into parsed_json, anchors and word array
def parse_tei(xml_bytes: bytes) -> tuple[dict, list[dict], list[dict]]:
    #root is lxml object
    root = etree.fromstring(xml_bytes)
    tag = _strip_ns(root.tag)
    if tag not in ("TEI", "teiCorpus"):
        raise ValueError(f"Root element must be TEI or teiCorpus, got: {tag}")
    # state is a dictionary that contains the current state of the parser, it records the data "globally" while processing this document.
    state = {
        "anchors": [],
        "word_array": [],
        "next_anchor_id": 0,
        "next_word_idx": 0,
        "line_counter": 0,
    }
    parsed_json = _walk(root, parent_id=None, state=state)
    return parsed_json, state["anchors"], state["word_array"]

# recursively walk the lxml object
def _walk(el, parent_id, state, in_skip=False):
    tag = _strip_ns(el.tag)
    skip_words = in_skip or (tag in SKIP_TAGS)

    anchor_id = state["next_anchor_id"]
    state["next_anchor_id"] += 1

    attrs = {_strip_ns(k): v for k, v in el.attrib.items()}

    line_no = None
    if tag == "l":
        n_attr = attrs.get("n")
        if n_attr is not None:
            line_no = n_attr
        else:
            state["line_counter"] += 1
            line_no = str(state["line_counter"])

    # create a new anchor object for the current element
    anchor = {
        "id": anchor_id,
        "tag": tag,
        "attrs": attrs,
        "line_no": line_no,
        "word_char_offsets": [],
    }
    state["anchors"].append(anchor)

    children = []
    #work as a counter for the character position
    char_pos = 0

    if el.text and el.text.strip():
        text_node, char_pos = _tokenize_text(
            el.text, anchor_id, anchor, char_pos, state, skip_words
        )
        children.append(text_node)
    # recursively walk the children of the current element
    for child in el:
        sub = _walk(child, anchor_id, state, skip_words)
        if sub is not None:
            children.append(sub)
        if child.tail and child.tail.strip():
            
            text_node, char_pos = _tokenize_text(
                child.tail, anchor_id, anchor, char_pos, state, skip_words
            )
            children.append(text_node)

    node = {"tag": tag}
    if attrs:
        node["attrs"] = attrs
    if children:
        node["children"] = children
    return node

# Tokenize a string into words and separators.
# Each word get a global word index(this is the ith word in the document), anchor_id, and start/end offsets inside the current anchor
# Separators are kept for rendering and snippets.
def _tokenize_text(text, anchor_id, anchor, char_pos, state, skip_words=False):
    segments = []
    for match in _WORD_RE.finditer(text):
        chunk = match.group(0)
        chunk_start = char_pos
        chunk_end = char_pos + len(chunk)
        #if the chunk is a word
        if chunk[0].isalnum() and not skip_words:
            idx = state["next_word_idx"]
            state["next_word_idx"] += 1
            segments.append({"kind": "word", "text": chunk, "idx": idx})
            state["word_array"].append({"w": chunk, "a": anchor_id, "sep": ""})
            anchor["word_char_offsets"].append([idx, chunk_start, chunk_end])
        #if the chunk is a separator
        else:
            segments.append({"kind": "sep", "text": chunk})
            if not skip_words and state["word_array"]:
                state["word_array"][-1]["sep"] = chunk

        char_pos = chunk_end

    return {"type": "text", "segments": segments}, char_pos