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

    def test_every_built_in_file_parses_into_words(self):
        corpus = sorted((settings.BASE_DIR / "tei").glob("*.xml"))
        self.assertEqual(len(corpus), 12)

        for path in corpus:
            with self.subTest(path.name):
                tree, anchors, word_array = parse_tei(path.read_bytes())
                self.assertEqual(tree["tag"], "TEI")
                self.assertTrue(anchors)
                self.assertTrue(word_array)


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