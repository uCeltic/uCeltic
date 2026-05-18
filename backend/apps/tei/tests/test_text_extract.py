import os 
from django.test import TestCase
from apps.tei.services.text_extract import extract_text_and_anchors
from apps.tei.services.parse import parse_tei

FIXTURES = os.path.join(os.path.dirname(__file__), 'fixtures')

class TextExtractTestCase(TestCase):
    def _load(self, filename):
        with open(os.path.join(FIXTURES, filename), 'rb') as f:
            return parse_tei(f.read())
        
    def test_basic_serafin07(self):
        tree = self._load('serafin07.xml')
        plain_text, anchors = extract_text_and_anchors(tree)
        self.assertGreater(len(plain_text), 0)
        self.assertGreater(len(anchors), 0)

        for a in anchors:
            self.assertGreaterEqual(a['text_start'], 0)
            self.assertIsNotNone(a['text_end'])
            self.assertLessEqual(a['text_start'], a['text_end'])
            self.assertLessEqual(a['text_end'], len(plain_text))
    
    def test_skip_teiHeader(self):
        tree = self._load('serafin07.xml')
        plain_text, anchors = extract_text_and_anchors(tree)

        tags = {a['tag'] for a in anchors}
        self.assertNotIn('teiHeader', tags)

    def test_anchors_have_required_fields(self):
        tree = self._load('serafin07.xml')
        plain_text, anchors = extract_text_and_anchors(tree)

        for a in anchors:
            self.assertIn('id', a)
            self.assertIn('tag', a)
            self.assertIn('line_no', a)
            self.assertIn('text_start', a)
            self.assertIn('text_end', a)
    
    def test_anchors_ids_are_unique_and_sequential(self):
        tree = self._load('serafin07.xml')
        plain_text, anchors = extract_text_and_anchors(tree)

        ids = [a['id'] for a in anchors]

        self.assertEqual(ids, list(range(len(anchors))))
    
    
    # black box
    def test_offset_correctness(self):
      """anchor's text_start/text_end slice must cover the text content of the element"""
      xml = b"""<?xml version="1.0"?>
  <TEI>
    <text>
      <body>
        <p>Hello world</p>
        <p>foo bar</p>
      </body>
    </text>
  </TEI>"""
      tree = parse_tei(xml)
      plain_text, anchors = extract_text_and_anchors(tree)
      print(plain_text)
      print("_____________________")
      print(anchors)
      
      p_anchors = [a for a in anchors if a["tag"] == "p"]
      self.assertEqual(len(p_anchors), 2)

      # First <p> should contain "Hello world"
      a0 = p_anchors[0]
      slice0 = plain_text[a0["text_start"]:a0["text_end"]]
      self.assertIn("Hello world", slice0)

      # Second <p> should contain "foo bar"
      a1 = p_anchors[1]
      slice1 = plain_text[a1["text_start"]:a1["text_end"]]
      self.assertIn("foo bar", slice1)

      # Two slices should not contain each other's text
      self.assertNotIn("foo bar", slice0)
      self.assertNotIn("Hello world", slice1)