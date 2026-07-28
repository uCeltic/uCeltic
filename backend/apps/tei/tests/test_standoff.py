"""#151 — `standOff` carries the name authority list, not manuscript text.

The three Acallam manuscripts declare 33 people and 10 places in a `standOff`
sibling of `teiHeader` and `text`, each entry listing a canonical headword and
up to 13 spelling variants. None of that is text the reader is reading, so none
of it belongs in the search index: spellings that occur *only* in the authority
list would otherwise return a hit pointing at a region outside the work.

It stays in `parsed_json` — the Tag Filter reads it there (#147) — and it keeps
allocating anchor ids, because backend `_flatten` and frontend `assignAnchorIds`
must traverse the same node set or every later anchor shifts. That is exactly
the treatment `teiHeader` already gets on the frontend.
"""
from django.test import TestCase

from apps.tei.services.parse import parse_tei

# The markup shape of the research corpus, cut down to two entries: a person
# whose variants are spelled nowhere else, and the body reference that points
# at it.
STANDOFF_TEI = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Acallam</title></titleStmt></fileDesc></teiHeader>
  <standOff>
    <listPerson>
      <person xml:id="fionn">
        <persName type="canonical">Find mac Cumaill</persName>
        <persName type="variant">Fhionn</persName>
      </person>
    </listPerson>
    <listPlace>
      <place xml:id="eriu">
        <placeName type="canonical">Ériu</placeName>
        <placeName type="variant">Banbha</placeName>
      </place>
    </listPlace>
  </standOff>
  <text><body>
    <l n="1">do chuaid <persName ref="#fionn">Find</persName> co <placeName ref="#eriu">hÉrinn</placeName></l>
  </body></text>
</TEI>""".encode("utf-8")


def find_node(node, tag):
    if node.get("tag") == tag:
        return node
    for child in node.get("children", ()):
        found = find_node(child, tag)
        if found is not None:
            return found
    return None


class StandOffIsNotIndexedTest(TestCase):
    def test_the_index_starts_at_the_first_word_of_the_text(self):
        _, _, word_array = parse_tei(STANDOFF_TEI)

        self.assertEqual(
            [w["w"] for w in word_array],
            ["do", "chuaid", "Find", "co", "hÉrinn"],
        )

    def test_a_spelling_only_in_the_authority_list_is_not_searchable(self):
        _, _, word_array = parse_tei(STANDOFF_TEI)

        indexed = {w["w"] for w in word_array}
        self.assertNotIn("Fhionn", indexed)
        self.assertNotIn("Banbha", indexed)


class StandOffSurvivesInParsedJsonTest(TestCase):
    """It is data the reader needs, so it is parsed and reachable — just not
    indexed, and (on the frontend) not rendered."""

    def test_the_subtree_is_still_present(self):
        tree, _, _ = parse_tei(STANDOFF_TEI)

        self.assertIsNotNone(find_node(tree, "standOff"))

    def test_entries_keep_their_ids_and_types(self):
        tree, _, _ = parse_tei(STANDOFF_TEI)

        person = find_node(find_node(tree, "standOff"), "person")
        # parse.py strips namespaces from attribute names, so `xml:id` arrives
        # as plain `id` — the trap #147's authority reader has to know about.
        self.assertEqual(person["attrs"]["id"], "fionn")
        headword = person["children"][1]
        self.assertEqual(headword["attrs"]["type"], "canonical")

    def test_the_text_is_still_in_the_render_tree(self):
        tree, _, _ = parse_tei(STANDOFF_TEI)

        person = find_node(find_node(tree, "standOff"), "person")
        rendered = "".join(
            seg["text"]
            for name in person["children"]
            if name.get("tag")
            for child in name.get("children", ())
            for seg in child.get("segments", ())
        )
        self.assertIn("Find mac Cumaill", rendered)


class StandOffStillAllocatesAnchorsTest(TestCase):
    """Skipping *indexing* is not skipping *traversal*. Drop the subtree from
    the anchor walk and every anchor after it shifts, so highlighting lands on
    the wrong line."""

    def test_the_subtree_keeps_its_anchors(self):
        _, anchors, _ = parse_tei(STANDOFF_TEI)

        tags = [a["tag"] for a in anchors]
        self.assertIn("standOff", tags)
        self.assertIn("listPerson", tags)
        self.assertIn("person", tags)

    def test_body_anchor_ids_are_unaffected_by_the_skip(self):
        _, anchors, word_array = parse_tei(STANDOFF_TEI)

        by_id = {a["id"]: a for a in anchors}
        first_word = word_array[0]
        self.assertEqual(by_id[first_word["a"]]["tag"], "l")
