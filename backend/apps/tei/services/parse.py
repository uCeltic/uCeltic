from lxml import etree

def _strip_ns(tag:str) -> str:
    """Remove XML namespace prefix from tag name."""
    return tag.split('}')[-1] if "}" in tag else tag

def _element_to_node(el) -> dict:

    tag = _strip_ns(el.tag)

    attrs = {}
    for k, v in el.attrib.items():
        clean_key = _strip_ns(k)
        attrs[clean_key] = v

    children = []
    if el.text and el.text.strip():
        children.append({'type': "text", "text": el.text})
    
    for child in el:
        children.append(_element_to_node(child))
        if child.tail and child.tail.strip():
            children.append({'type': "text", "text": child.tail})

    node = {'tag': tag}
    if attrs:
        node['attrs'] = attrs
    if children:
        node['children'] = children
    return node

def parse_tei(xml_bytes:bytes) -> dict:
    root = etree.fromstring(xml_bytes)
    tag = _strip_ns(root.tag)
    if tag not in ('TEI', 'teiCorpus'):
        raise ValueError(f"Root element must be TEI or teiCorpus, got: {tag}")
      
    return _element_to_node(root)