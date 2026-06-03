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