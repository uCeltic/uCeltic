"""#151, #162 — `standOff` carries apparatus, not manuscript text.

The Acallam witnesses this skip was written for declared a name authority list
there. They are gone (#162): the ll. 2390–2594 corpus that replaced them carries
no `standOff` at all, grouping its named entities by a bare `@nymRef` instead.

The skip stays, because `standOff` is a general place to file things that are
*about* the text, and the shipped corpus still uses it that way —
`serafin03.xml` files 20 transcription notes there and `serafin07.xml` two more,
in Polish, recording what the scribe struck out. None of that is text the reader
is reading, so none of it belongs in the search index: a word occurring *only*
in the apparatus would otherwise return a hit pointing at a region outside the
work.

It stays in `parsed_json`, and it keeps allocating anchor ids, because backend
`_flatten` and frontend `assignAnchorIds` must traverse the same node set or
every later anchor shifts. Whether it is also hidden on screen is the frontend's
own decision — its `SKIP_TAGS`, not this one.
"""
from django.conf import settings
from django.test import TestCase

from apps.tei.services.parse import parse_tei

# The markup shape `serafin03.xml` uses, cut down to two notes: a `standOff`
# sibling of `teiHeader` and `text`, holding a `listAnnotation` of transcription
# notes that point back into the body with `@target`.
STANDOFF_TEI = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Serafin</title></titleStmt></fileDesc></teiHeader>
  <standOff>
    <listAnnotation>
      <note n="a" type="transcription" target="#aa">districti skreślone</note>
      <note n="b" type="transcription" target="#ab">na marginesie</note>
    </listAnnotation>
  </standOff>
  <text><body>
    <l n="1">quia <anchor xml:id="aa"/>distanti loco <anchor xml:id="ab"/>eam</l>
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
            ["quia", "distanti", "loco", "eam"],
        )

    def test_a_word_only_in_the_apparatus_is_not_searchable(self):
        _, _, word_array = parse_tei(STANDOFF_TEI)

        indexed = {w["w"] for w in word_array}
        self.assertNotIn("skreślone", indexed)
        self.assertNotIn("marginesie", indexed)


class ShippedApparatusIsNotIndexedTest(TestCase):
    """The same claim about the file itself, not a fixture shaped like it — so
    that removing the skip fails here even if the fixture drifts out of step
    with what the corpus actually files in `standOff`."""

    def test_serafin03s_transcription_notes_stay_out_of_the_index(self):
        path = settings.BASE_DIR / "tei" / "serafin03.xml"

        _, _, word_array = parse_tei(path.read_bytes())

        indexed = {w["w"] for w in word_array}
        # Polish editorial vocabulary that occurs in the notes and nowhere in
        # the Latin text they annotate.
        self.assertNotIn("skreślone", indexed)
        self.assertNotIn("marginesie", indexed)
        self.assertNotIn("wytarte", indexed)


class StandOffSurvivesInParsedJsonTest(TestCase):
    """Skipping the index is not dropping the subtree. It is parsed and
    reachable — just not indexed, and (on the frontend) not rendered."""

    def test_the_subtree_is_still_present(self):
        tree, _, _ = parse_tei(STANDOFF_TEI)

        self.assertIsNotNone(find_node(tree, "standOff"))

    def test_the_text_is_still_in_the_render_tree(self):
        tree, _, _ = parse_tei(STANDOFF_TEI)

        note = find_node(find_node(tree, "standOff"), "note")
        rendered = "".join(
            seg["text"] for child in note["children"] for seg in child.get("segments", ())
        )
        self.assertIn("districti skreślone", rendered)


class StandOffStillAllocatesAnchorsTest(TestCase):
    """Skipping *indexing* is not skipping *traversal*. Drop the subtree from
    the anchor walk and every anchor after it shifts, so highlighting lands on
    the wrong line."""

    def test_the_subtree_keeps_its_anchors(self):
        _, anchors, _ = parse_tei(STANDOFF_TEI)

        tags = [a["tag"] for a in anchors]
        self.assertIn("standOff", tags)
        self.assertIn("listAnnotation", tags)
        self.assertIn("note", tags)

    def test_body_anchor_ids_are_unaffected_by_the_skip(self):
        _, anchors, word_array = parse_tei(STANDOFF_TEI)

        by_id = {a["id"]: a for a in anchors}
        first_word = word_array[0]
        self.assertEqual(by_id[first_word["a"]]["tag"], "l")
