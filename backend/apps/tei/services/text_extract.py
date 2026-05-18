"""Walk a parsed TEI JSON tree to produce:
  - plain_text: concatenated text content, with a space inserted at each
                element boundary so word tokenizers don't glue neighbours
  - anchors:    one entry per element, mapping it to the [start, end)
                character range it covers in plain_text

The two together let a flat-string search algorithm (Levenshtein, FTS, ...)
return char offsets, which can then be looked up against `anchors` to
recover the originating TEI element for the frontend to scroll/highlight."""

# Subtrees we don't want in the searchable text.
SKIP_TAGS = {"teiHeader"}


def extract_text_and_anchors(tree: dict) -> tuple[str, list[dict]]:
    parts: list[str] = []
    anchors: list[dict] = []
    cursor = [0]
    next_id = [0]
    line_counter = [0]

    def emit(text: str) -> None:
        parts.append(text)
        cursor[0] += len(text)

    def walk(node, path):
        if isinstance(node, dict) and node.get("type") == "text":
            emit(node["text"])
            return

        tag = node.get("tag")
        if tag in SKIP_TAGS:
            return

        # Space at element boundary so adjacent text doesn't fuse.
        if cursor[0] > 0 and not parts[-1].endswith((" ", "\n", "\t")):
            emit(" ")

        anchor_id = next_id[0]
        next_id[0] += 1

        line_no = None
        if tag == "l":
            attrs = node.get("attrs") or {}
            n_attr = attrs.get("n")
            if n_attr is not None:
                line_no = n_attr
            else:
                line_counter[0] += 1
                line_no = str(line_counter[0])

        anchor = {
            "id": anchor_id,
            "path": list(path),
            "tag": tag,
            "attrs": node.get("attrs") or {},
            "line_no": line_no,
            "text_start": cursor[0],
            "text_end": None,
        }
        anchors.append(anchor)

        for i, child in enumerate(node.get("children") or []):
            walk(child, path + [i])

        anchor["text_end"] = cursor[0]

    walk(tree, [])
    return "".join(parts), anchors
