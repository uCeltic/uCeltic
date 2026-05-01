from .parse import parse_tei, _element_to_node
from lxml import etree

def _find_first(node: dict, tag: str) -> dict | None:
    if node.get("tag") == tag:
        return node
    for child in node.get("children", []):
        if isinstance(child, dict) and child.get("type") != "text":
            result = _find_first(child, tag)
            if result:
                return result
    return None

def _text_of(node:dict) -> str:
    parts = []
    for child in node.get("children", []):
        if isinstance(child, dict):
            if child.get("type") == "text":
                parts.append(child["text"])
            else:
                parts.append(_text_of(child))
    return "".join(parts).strip()


def _count_tag(node:dict, tag:str) -> int:
    count = 1 if node.get("tag") == tag else 0
    for child in node.get("children", []):
        if isinstance(child, dict) and child.get("type") != "text":
            count += _count_tag(child, tag)
    return count

def extract_meta(tree: dict) -> dict:
    header = _find_first(tree, "teiHeader")
    title = ""
    author = ""
    if header:
        title_node = _find_first(header, "title")
        if title_node:
            title = _text_of(title_node)
        author_node = _find_first(header, "author")
        if author_node:
            author = _text_of(author_node)
    language = tree.get("attrs", {}).get("lang", "")
    pb_count = _count_tag(tree, "pb")
    return {
        "title": title,
        "author": author,
        "language": language,
        "pbCount": pb_count,
    }

