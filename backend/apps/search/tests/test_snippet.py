"""#145 — result snippets are rebuilt from word_array, so they inherited every
defect the index had. With fragments gone the remaining one is the separator
fallback: `sep or " "` invented a space wherever a separator was empty, which
put a visible gap at every fragment boundary and made snippets unreadable.

On a faithful index an empty separator means the source has nothing there, and
the snippet must say so.
"""
from django.test import TestCase

from apps.search.services.run_search import run_search
from apps.tei.models import TEIDocument
from apps.tei.services.parse import parse_tei


# The note is flush against `talam`, with no whitespace on either side of it.
# It leaves the index, so the two words it sits between end up genuinely
# adjacent — the one case where an empty separator survives the rewrite.
FLUSH_NOTE_TEI = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body>
    <l n="1">ro gab i<expan>n</expan> tal<expan>am</expan><note>Sic.</note>trochull</l>
  </body></text>
</TEI>""".encode("utf-8")


class SnippetTest(TestCase):

    def setUp(self):
        tree, anchors, word_array = parse_tei(FLUSH_NOTE_TEI)
        # No xml_file, so the post_save parse bows out and these stay as parsed.
        self.doc = TEIDocument.objects.create(
            title="Test Doc",
            language="ga",
            parsed_json=tree,
            anchors=anchors,
            word_array=word_array,
        )

    def test_a_word_split_by_an_element_is_searchable(self):
        results = run_search(self.doc.id, "talam")

        self.assertTrue(results)
        self.assertIn("talam", results[0]["snippet"])

    def test_an_empty_separator_is_not_turned_into_a_space(self):
        results = run_search(self.doc.id, "talam trochull")

        self.assertEqual(results[0]["snippet"], "talamtrochull")

    def test_a_snippet_keeps_the_separators_the_source_has(self):
        results = run_search(self.doc.id, "ro gab in")

        self.assertEqual(results[0]["snippet"], "ro gab in")
