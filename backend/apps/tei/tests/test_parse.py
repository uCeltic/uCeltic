from django.conf import settings
from django.test import TestCase
from lxml import etree

from apps.tei.services.parse import parse_tei


# Navigate by tag, not by position: XML indentation is preserved as text nodes
# (#145), so an element's children are interleaved with whitespace.
def child(node, tag):
    return next(c for c in node["children"] if c.get("tag") == tag)


def descend(node, *tags):
    for tag in tags:
        node = child(node, tag)
    return node

SIMPLE_TEI = b"""<?xml version="1.0" encoding="UTF-8"?>
  <TEI xmlns="http://www.tei-c.org/ns/1.0">
    <teiHeader>
      <fileDesc>
        <titleStmt>
          <title>Test Document</title>
        </titleStmt>
      </fileDesc>
    </teiHeader>
    <text>
      <body>
        <p>Hello <persName>Cu Chulainn</persName> world.</p>
      </body>
    </text>
  </TEI>"""


COMMENTED_TEI = b"""<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <body>
      <!-- editorial note -->
      <l n="1">first line</l>
      <?oxygen RNGSchema="tei.rng"?>
      <l n="2">second line</l>
      <p>before <!-- inline remark --> after</p>
    </body>
  </text>
</TEI>"""


class ParseTEICommentsTest(TestCase):
    """Comments and processing instructions are well-formed XML, so they must
    not break the parse (#142). They are dropped from parsed_json; xml_file
    stays the source of truth for the original document."""

    def test_comment_and_pi_do_not_break_parse(self):
        tree, _, _ = parse_tei(COMMENTED_TEI)

        self.assertEqual(tree["tag"], "TEI")

    def test_comments_and_pis_are_dropped_from_the_tree(self):
        tree, _, _ = parse_tei(COMMENTED_TEI)

        body = descend(tree, "text", "body")
        tags = [c.get("tag") for c in body["children"] if c.get("tag")]
        self.assertEqual(tags, ["l", "l", "p"])

    def test_text_after_a_comment_is_still_tokenised(self):
        _, _, word_array = parse_tei(COMMENTED_TEI)

        words = [w["w"] for w in word_array]
        self.assertEqual(
            words, ["first", "line", "second", "line", "before", "after"]
        )

    def test_no_anchor_is_allocated_for_a_comment(self):
        _, anchors, _ = parse_tei(COMMENTED_TEI)

        self.assertEqual(
            [a["tag"] for a in anchors], ["TEI", "text", "body", "l", "l", "p"]
        )


class ParseTEIEntityTest(TestCase):
    """Entities never reach _walk: lxml resolves them while building the tree.
    A declared entity becomes ordinary text; an undeclared one is not
    well-formed, so rejecting it is the documented contract, not a defect."""

    def test_declared_entity_is_expanded_into_the_index(self):
        xml = b"""<?xml version="1.0"?>
<!DOCTYPE TEI [<!ENTITY tir "Tir na nOg">]>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body><p>go &tir; now</p></body></text>
</TEI>"""

        _, _, word_array = parse_tei(xml)

        self.assertEqual(
            [w["w"] for w in word_array], ["go", "Tir", "na", "nOg", "now"]
        )

    def test_undeclared_entity_is_rejected_as_not_well_formed(self):
        xml = b"""<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body><p>go &tir; now</p></body></text>
</TEI>"""

        with self.assertRaises(etree.XMLSyntaxError):
            parse_tei(xml)


class ParseBuiltInCorpusTest(TestCase):
    """The built-in corpus is the app's primary content, so every file in it
    must stay parseable — that is the regression this guards (#142)."""

    # Four Acallam witnesses at ll. 2390–2594 (#162) and four sample files.
    # The count is asserted so a file that silently fails to ship is a failure
    # rather than a loop that runs over one document fewer.
    CORPUS_SIZE = 8

    def test_every_built_in_file_parses_into_words(self):
        corpus = sorted((settings.BASE_DIR / "tei").glob("*.xml"))
        self.assertEqual(len(corpus), self.CORPUS_SIZE)

        for path in corpus:
            with self.subTest(path.name):
                tree, anchors, word_array = parse_tei(path.read_bytes())
                self.assertEqual(tree["tag"], "TEI")
                self.assertTrue(anchors)
                self.assertTrue(word_array)


class NymRefSurvivesParsingTest(TestCase):
    """#162 — the ll. 2390–2594 witnesses group their named entities with a bare
    `@nymRef` on `name` / `addName`, and nothing in the file says what a group
    id stands for. The parser has no opinion about that; what it owes the
    frontend is the attribute, unchanged, on a node the reader can see.

    Asserted against the shipped files rather than a fixture, because the
    grouping is a property of this corpus — a `name` quietly added to
    `SKIP_TAGS`, or an attribute rewritten on the way through, would take the
    registry slice's only input with it.
    """

    NYMREF_TEI = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body>
    <p>do <name type="person" nymRef="F64">Ḟin<expan>n</expan></name>
       a h<name type="place" nymRef="e6">Ēir<expan>inn</expan></name>
       <addName nymRef="P1">Tāilgend</addName></p>
  </body></text>
</TEI>""".encode("utf-8")

    def _named_entities(self, node, found=None):
        found = [] if found is None else found
        if node.get("tag") in ("name", "addName"):
            found.append(node)
        for child in node.get("children", ()):
            if child.get("tag"):
                self._named_entities(child, found)
        return found

    def _body_entities(self, tree):
        """Named entities in `text` only.

        `teiHeader` has a `name` of its own — the editor, in `respStmt` — and
        it is not a named entity in the work. Counting it would put a modern
        scholar in the same population as Find mac Cumaill.
        """
        text = next(c for c in tree["children"] if c.get("tag") == "text")
        return self._named_entities(text)

    def test_the_group_id_reaches_parsed_json_unchanged(self):
        tree, _, _ = parse_tei(self.NYMREF_TEI)

        # Bare, not `#F64`: these are group keys, not resolvable TEI pointers,
        # and prefixing one would invent a pointer the corpus never wrote.
        self.assertEqual(
            [e["attrs"]["nymRef"] for e in self._named_entities(tree)],
            ["F64", "e6", "P1"],
        )

    def test_a_named_entity_is_still_indexed(self):
        _, _, word_array = parse_tei(self.NYMREF_TEI)

        # And still joined across the `expan` inside it (#145) — the entity
        # elements are not a skipped subtree.
        self.assertIn("Ḟinn", [w["w"] for w in word_array])

    def test_every_acallam_witness_carries_the_grouping(self):
        corpus = sorted((settings.BASE_DIR / "tei").glob("AcS_*.xml"))
        self.assertEqual(len(corpus), 4)

        grouped, ungrouped = 0, []
        for path in corpus:
            tree, _, _ = parse_tei(path.read_bytes())

            entities = self._body_entities(tree)
            self.assertTrue(entities, path.name)
            for entity in entities:
                if (entity.get("attrs") or {}).get("nymRef"):
                    grouped += 1
                else:
                    ungrouped.append(entity.get("attrs") or {})

        # 674 `name` / `addName` elements ship in the four witnesses, but four
        # of them are the editor in `respStmt`, not people in the story. 670 are
        # named entities, and 662 of those carry a group id.
        self.assertEqual(grouped + len(ungrouped), 670)
        self.assertEqual(grouped, 662)

    def test_the_ungrouped_named_entities_are_the_eight_known_tagging_slips(self):
        """Eight of the corpus's 670 named entities carry no `@nymRef`, and the
        registry slice cannot place them.

        They are pinned rather than tolerated silently: six put the group id in
        `@n` instead (`n="F21"`, Feradach, in every witness but G 126), and two
        in G 126 carry no id at all. The numbers drop when the corpus is re-cut
        with the slips fixed, and this test is where that is noticed.
        """
        attrs = []
        for path in sorted((settings.BASE_DIR / "tei").glob("AcS_*.xml")):
            tree, _, _ = parse_tei(path.read_bytes())
            attrs += [
                e.get("attrs") or {}
                for e in self._body_entities(tree)
                if not (e.get("attrs") or {}).get("nymRef")
            ]

        self.assertEqual(len(attrs), 8)
        self.assertEqual(sum(1 for a in attrs if a.get("n") == "F21"), 6)
        self.assertEqual(sum(1 for a in attrs if not a.get("n")), 2)


class ParseTEITest(TestCase):

    def test_root_tag(self):
        tree, anchors, word_array = parse_tei(SIMPLE_TEI)   # 解包三元组
        self.assertEqual(tree["tag"], "TEI")
  
    def test_has_children(self):
        tree, _, _ = parse_tei(SIMPLE_TEI)

        self.assertIn("children", tree)

    # black box
    def test_text_node(self):
        tree, _, _ = parse_tei(SIMPLE_TEI)

  
        paragraph = descend(tree, "text", "body", "p")

        first_child = paragraph["children"][0]
        self.assertEqual(first_child["type"], "text")
        words = [s["text"] for s in first_child["segments"]]       # text 改成读 segments
        self.assertIn("Hello", words)
    # black box
    def test_wrong_root_raises(self):
        with self.assertRaises(ValueError):
            parse_tei(b"<foo><bar/></foo>")