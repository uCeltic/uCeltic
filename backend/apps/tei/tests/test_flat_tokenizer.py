"""#145 — tokenisation runs on a flattened character stream, not per text node.

Real editorial TEI marks up *inside* words (`tal<expan>am</expan>`), so an
element boundary is not a word boundary. These tests are written against the
markup shapes that actually occur in the research corpus, because the 12
built-in sample files barely contain any of them — which is why the defect
survived this long.
"""
import re

from django.conf import settings
from django.test import TestCase
from lxml import etree

from apps.tei.services.parse import SKIP_TAGS, _strip_ns, parse_tei


def source_text(el, skip_tags=()) -> str:
    """Every character of text in the document with all tags ignored.

    The ground truth both reconstructions are measured against. Comments and
    PIs contribute nothing but their tail, exactly as the parser treats them.
    Subtrees named in `skip_tags` contribute nothing but their tail either,
    which is what "excluded from the index" has to mean.
    """
    if not isinstance(el.tag, str) or _strip_ns(el.tag) in skip_tags:
        return ""
    out = [el.text] if el.text else []
    for child in el:
        out.append(source_text(child, skip_tags))
        if child.tail:
            out.append(child.tail)
    return "".join(out)


def rendered_text(node) -> str:
    """The text the React renderer paints, reconstructed from parsed_json.

    TEIRenderer joins every segment's `text` and renders nothing else, so this
    is the render path exactly — a separate reconstruction from word_array.
    """
    if node.get("type") == "text":
        return "".join(seg["text"] for seg in node["segments"])
    return "".join(rendered_text(child) for child in node.get("children", ()))


def indexed_text(word_array) -> str:
    """The text the search index holds, reconstructed from word_array."""
    return "".join(entry["w"] + entry["sep"] for entry in word_array)


def normalise(text: str) -> str:
    """Collapse whitespace runs, the way the browser does for `white-space: normal`."""
    return re.sub(r"\s+", " ", text).strip()


# `expan` marks an editorially expanded scribal abbreviation, and it is the
# most frequent element in the research corpus. It nearly always sits inside
# a word, in every position: mid-word, word-final and word-initial.
EXPAN_TEI = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body>
    <l n="1">ro gab i<expan>n</expan> tal<expan>am</expan> trochull</l>
    <l n="2">rer <expan>con</expan>aib c<expan>ar</expan>b</l>
  </body></text>
</TEI>""".encode("utf-8")


class FlatStreamTokenisationTest(TestCase):
    """A word is whatever the character stream says it is, regardless of how
    many elements it passes through on the way."""

    def test_a_word_split_by_an_element_is_indexed_whole(self):
        _, _, word_array = parse_tei(EXPAN_TEI)

        self.assertEqual(
            [w["w"] for w in word_array],
            ["ro", "gab", "in", "talam", "trochull", "rer", "conaib", "carb"],
        )

    def test_a_word_records_its_offsets_in_every_anchor_it_spans(self):
        _, anchors, word_array = parse_tei(EXPAN_TEI)

        talam = [w["w"] for w in word_array].index("talam")
        spanning = [a for a in anchors
                    if any(off[0] == talam for off in a["word_char_offsets"])]

        # `tal` sits in the line's own text, `am` in the expan element.
        self.assertEqual([a["tag"] for a in spanning], ["l", "expan"])

    def test_offsets_are_local_to_the_anchors_own_text(self):
        _, anchors, word_array = parse_tei(EXPAN_TEI)

        talam = [w["w"] for w in word_array].index("talam")
        line = next(a for a in anchors if a["line_no"] == "1")
        expan = next(a for a in anchors if a["tag"] == "expan"
                     and any(off[0] == talam for off in a["word_char_offsets"]))

        # "ro gab i" is 8 characters of the line's own text, then the first
        # expan interrupts; " tal" resumes at 8 and runs to 12.
        self.assertEqual(
            [off for off in line["word_char_offsets"] if off[0] == talam],
            [[talam, 9, 12]],
        )
        self.assertEqual(expan["word_char_offsets"], [[talam, 0, 2]])

    def test_a_word_that_re_enters_an_anchor_records_one_range_there(self):
        # `annsin` leaves the line twice and comes back twice. The three
        # characters it leaves behind in the line are contiguous in the line's
        # own coordinates, so they are one range, not three.
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body><l n="1">a<expan>n</expan>n<expan>si</expan>n</l></body></text>
</TEI>""".encode("utf-8")

        _, anchors, word_array = parse_tei(xml)

        self.assertEqual([w["w"] for w in word_array], ["annsin"])
        indexed = [(a["tag"], a["word_char_offsets"]) for a in anchors
                   if a["word_char_offsets"]]
        self.assertEqual(
            indexed,
            [("l", [[0, 0, 3]]), ("expan", [[0, 0, 1]]), ("expan", [[0, 0, 2]])],
        )

    def test_a_word_belongs_to_the_anchor_it_starts_in(self):
        _, _, word_array = parse_tei(EXPAN_TEI)
        _, anchors, _ = parse_tei(EXPAN_TEI)
        anchors_by_id = {a["id"]: a for a in anchors}

        by_word = {w["w"]: anchors_by_id[w["a"]]["tag"] for w in word_array}

        self.assertEqual(by_word["talam"], "l")
        self.assertEqual(by_word["conaib"], "expan")


WHITESPACE_TEI = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body>
    <l n="1">ro fīarf<expan>aig</expan> <name>Eoch</name>aid</l>
    <l n="2">a hÉrind?’.</l>
    <l n="3">‘IS ed fodera</l>
  </body></text>
</TEI>""".encode("utf-8")


class WhitespaceAndSeparatorTest(TestCase):
    """Whitespace-only text is text. Dropping it glued words together in the
    reading pane and left the index without the separators it needed."""

    def test_whitespace_between_elements_survives_into_the_index(self):
        _, _, word_array = parse_tei(WHITESPACE_TEI)

        words = [w["w"] for w in word_array]
        self.assertIn("fīarfaig", words)
        self.assertIn("Eochaid", words)

    def test_whitespace_between_elements_survives_into_the_render(self):
        tree, _, _ = parse_tei(WHITESPACE_TEI)

        self.assertIn("fīarfaig Eochaid", normalise(rendered_text(tree)))

    def test_separators_accumulate_instead_of_overwriting(self):
        _, _, word_array = parse_tei(WHITESPACE_TEI)

        herind = next(w for w in word_array if w["w"] == "hÉrind")

        # Closing punctuation of one line and the opening quote of the next
        # both belong here; the old tokenizer let the second erase the first.
        self.assertIn("?", herind["sep"])
        self.assertIn("’", herind["sep"])
        self.assertIn("‘", herind["sep"])

    def test_the_render_reproduces_the_source_character_for_character(self):
        tree, _, _ = parse_tei(WHITESPACE_TEI)
        root = etree.fromstring(WHITESPACE_TEI)

        self.assertEqual(normalise(rendered_text(tree)), normalise(source_text(root)))


# A note sits flush against the word before it, with no whitespace between.
# On a flattened stream that is the whole difficulty: nothing but an explicit
# boundary stops `illrechtaib` and `Dot` from being read as one word.
NOTE_TEI = """<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body>
    <l n="1">d’illrechtaib<note>Dot over b, looks accidental.</note> a tēighed</l>
  </body></text>
</TEI>""".encode("utf-8")


class SkippedRegionBoundaryTest(TestCase):
    """`note` is editorial commentary in English, so it leaves the index — but
    it stays on screen as a hover tooltip. Flattening makes the boundary
    between the two a responsibility of its own."""

    def test_note_content_is_not_indexed(self):
        _, _, word_array = parse_tei(NOTE_TEI)

        self.assertEqual(
            [w["w"] for w in word_array],
            ["d", "illrechtaib", "a", "tēighed"],
        )

    def test_a_word_never_spans_a_skipped_boundary(self):
        _, _, word_array = parse_tei(NOTE_TEI)

        self.assertNotIn("illrechtaibDot", [w["w"] for w in word_array])

    def test_punctuation_inside_a_note_does_not_leak_into_a_separator(self):
        _, _, word_array = parse_tei(NOTE_TEI)

        illrechtaib = next(w for w in word_array if w["w"] == "illrechtaib")

        # The separator chunk here straddles the skip boundary: the note's
        # trailing "." and the space after </note> are one regex match on the
        # flat stream, and only the half outside the note is ours.
        self.assertEqual(illrechtaib["sep"], " ")

    def test_note_content_still_renders(self):
        tree, _, _ = parse_tei(NOTE_TEI)

        self.assertIn("Dot over b", rendered_text(tree))

    def test_the_index_reproduces_the_source_minus_the_skipped_subtrees(self):
        _, _, word_array = parse_tei(NOTE_TEI)
        root = etree.fromstring(NOTE_TEI)

        self.assertEqual(
            normalise(indexed_text(word_array)),
            normalise(source_text(root, skip_tags=SKIP_TAGS)),
        )


class BuiltInCorpusReconstructionTest(TestCase):
    """The 168 mid-word elements in the built-in corpus were mis-indexed too.
    Both reconstructions have to hold for the shipped content, not only for
    the research files this issue was found on."""

    def _corpus(self):
        return sorted((settings.BASE_DIR / "tei").glob("*.xml"))

    def test_the_render_reproduces_every_built_in_file(self):
        for path in self._corpus():
            with self.subTest(path.name):
                tree, _, _ = parse_tei(path.read_bytes())
                root = etree.fromstring(path.read_bytes())

                self.assertEqual(
                    normalise(rendered_text(tree)), normalise(source_text(root))
                )

    def test_the_index_reproduces_every_built_in_file_minus_the_skipped_subtrees(self):
        for path in self._corpus():
            with self.subTest(path.name):
                _, _, word_array = parse_tei(path.read_bytes())
                root = etree.fromstring(path.read_bytes())

                self.assertEqual(
                    normalise(indexed_text(word_array)),
                    normalise(source_text(root, skip_tags=SKIP_TAGS)),
                )

    def test_mid_word_markup_in_the_built_in_corpus_is_joined(self):
        # 168 elements in this corpus cut a word in half (`supplied` 35,
        # `c` 32, `ex` 7, `placeName` 78). Each one used to shatter its word;
        # each one now yields a single word spanning more than one anchor —
        # 183 such words, because a few carry two inline elements at once.
        total = sum(
            len(_multi_anchor_words(parse_tei(path.read_bytes())[1]))
            for path in self._corpus()
        )

        self.assertEqual(total, 183)


def _multi_anchor_words(anchors) -> set[int]:
    seen, multi = set(), set()
    for anchor in anchors:
        for idx, _, _ in anchor["word_char_offsets"]:
            if idx in seen:
                multi.add(idx)
            seen.add(idx)
    return multi
