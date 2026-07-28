from django.test import TestCase
from apps.tei.services.parse import parse_tei  

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

        body = tree["children"][0]["children"][0]
        self.assertEqual([c.get("tag") for c in body["children"]], ["l", "l", "p"])

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

  
        body = tree["children"][1]["children"][0]["children"][0]

        self.assertEqual(body["tag"], "p")
        first_child = body["children"][0]
        self.assertEqual(first_child["type"], "text")
        words = [s["text"] for s in first_child["segments"]]       # text 改成读 segments
        self.assertIn("Hello", words)
    # black box
    def test_wrong_root_raises(self):
        with self.assertRaises(ValueError):
            parse_tei(b"<foo><bar/></foo>")