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
        tree = parse_tei(SIMPLE_TEI)
        self.assertEqual(tree["tag"], "TEI")

    def test_has_children(self):
        tree = parse_tei(SIMPLE_TEI)
        self.assertIn("children", tree)

    def test_text_node(self):
        tree = parse_tei(SIMPLE_TEI)
        body = tree["children"][1]["children"][0]["children"][0]
        self.assertEqual(body["tag"], "p")
        first_child = body["children"][0]
        self.assertEqual(first_child["type"], "text")
        self.assertIn("Hello", first_child["text"])

    def test_wrong_root_raises(self):
        with self.assertRaises(ValueError):
            parse_tei(b"<foo><bar/></foo>")