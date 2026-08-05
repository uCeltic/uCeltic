"""One document's account of the names it marks up (#163).

`@nymRef` is the only thing in this corpus that says "these spellings are one
person" — the four witnesses write the same man `Find` / `Fionn` / `Find` /
`Finn` — so the group id is the whole join key, and everything here is about
reading it exactly as the annotators wrote it, including where they wrote it
wrong.
"""
from pathlib import Path

from django.test import SimpleTestCase

from apps.tei.services.name_index import (
    build_name_index,
    headword_of,
    kind_of,
    surface_form,
)
from apps.tei.services.parse import anchor_elements, parse_tei
from lxml import etree

CORPUS = Path(__file__).resolve().parents[3] / "tei"
ACALLAM = sorted(CORPUS.glob("AcS_*.xml"))


def tei(body: str) -> bytes:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>'
        f"{body}"
        "</body></text></TEI>"
    ).encode()


class BuildNameIndexTest(SimpleTestCase):
    def test_it_groups_occurrences_under_the_id_they_carry(self):
        index = build_name_index(tei(
            '<l><name type="person" nymRef="F64">Find</name> and '
            '<name type="person" nymRef="F64">Finn</name> and '
            '<name type="place" nymRef="e6">Érend</name></l>'
        ))

        self.assertEqual(index["F64"]["count"], 2)
        self.assertEqual(index["e6"]["count"], 1)

    def test_the_id_is_read_verbatim_so_case_never_merges_two_groups(self):
        # A13 is Aed mac Echach Lethdeirg; a13 is Almu, a hillfort. 483 codes in
        # the team's own name lists collide this way, and lowercasing would
        # silently make one entity of a man and a place the first time both
        # appear in one upload.
        index = build_name_index(tei(
            '<l><name type="person" nymRef="A13">Aed</name>'
            '<name type="place" nymRef="a13">Almu</name></l>'
        ))

        self.assertEqual(sorted(index), ["A13", "a13"])

    def test_it_counts_every_spelling_the_group_is_written_with(self):
        index = build_name_index(tei(
            '<l><name type="person" nymRef="F64">Find</name>'
            '<name type="person" nymRef="F64">Find</name>'
            '<name type="person" nymRef="F64">Finn</name></l>'
        ))

        self.assertEqual(index["F64"]["variants"], {"Find": 2, "Finn": 1})

    def test_it_tallies_the_types_the_group_was_tagged_with(self):
        # Kept as a tally rather than a resolved kind, because the corpus-wide
        # answer is the majority over OCCURRENCES: `e6` is a place tagged
        # `person` once, and one document's verdict must not outvote another's
        # by document rather than by weight.
        index = build_name_index(tei(
            '<l><name type="place" nymRef="e6">Érend</name>'
            '<name type="place" nymRef="e6">Érind</name>'
            '<name type="person" nymRef="e6">Érend</name></l>'
        ))

        self.assertEqual(index["e6"]["types"], {"place": 2, "person": 1})

    def test_an_untyped_occurrence_still_counts_toward_the_group(self):
        # `addName` carries no `@type` at all and follows its group.
        index = build_name_index(tei(
            '<l><name type="person" nymRef="P1">Patraic</name>'
            '<addName nymRef="P1">Tāilgend</addName></l>'
        ))

        self.assertEqual(index["P1"]["count"], 2)
        self.assertEqual(index["P1"]["types"], {"person": 1})

    def test_it_records_the_anchor_of_every_occurrence(self):
        xml = tei(
            '<l><name type="person" nymRef="F64">Find</name></l>'
            '<l><name type="person" nymRef="F64">Finn</name></l>'
        )
        _, anchors, _ = parse_tei(xml)
        index = build_name_index(xml)

        for anchor_id in index["F64"]["anchors"]:
            self.assertEqual(anchors[anchor_id]["tag"], "name")
            self.assertEqual(anchors[anchor_id]["attrs"]["nymRef"], "F64")

    def test_a_document_with_no_grouped_name_contributes_nothing(self):
        self.assertEqual(build_name_index(tei("<l>do chuaid</l>")), {})


class BadDataTest(SimpleTestCase):
    """There is no lookup table, so there is no "not found" — an id nobody else
    uses is a group of one, and a name with no id is simply not grouped."""

    def test_a_mistyped_id_becomes_its_own_group_rather_than_an_error(self):
        # Lis204 writes nymRef="64" once where it writes F64 sixteen times. Two
        # near-identical menu rows are the signal to fix the source file; a
        # correction table in the app would hide the defect and never come out.
        index = build_name_index(tei(
            '<l><name type="person" nymRef="F64">Find</name>'
            '<name type="person" nymRef="64">Ḟin</name></l>'
        ))

        self.assertEqual(index["64"]["count"], 1)
        self.assertEqual(index["F64"]["count"], 1)

    def test_an_id_put_in_n_instead_of_nymref_joins_no_group(self):
        # `@n` is a different TEI attribute with a real meaning. Reading it as a
        # group id would invent a grouping the corpus never claimed.
        index = build_name_index(tei(
            '<l><name type="person" n="F21">Feradach</name></l>'
        ))

        self.assertEqual(index, {})

    def test_a_name_with_no_id_at_all_joins_no_group(self):
        index = build_name_index(tei("<l><name>Ārann</name></l>"))

        self.assertEqual(index, {})

    def test_an_id_on_something_that_is_not_a_name_is_ignored(self):
        index = build_name_index(tei('<l nymRef="F64">do chuaid</l>'))

        self.assertEqual(index, {})

    def test_names_in_the_header_and_in_notes_are_not_the_manuscript_s(self):
        # The editors name themselves in `teiHeader`, and a `note` is the
        # editor's English commentary — the same manuscript-text/commentary
        # boundary the search index draws (SKIP_TAGS).
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<TEI xmlns="http://www.tei-c.org/ns/1.0">'
            '<teiHeader><name type="person" nymRef="X1">An editor</name></teiHeader>'
            "<text><body>"
            '<l>a<note><name type="person" nymRef="X2">Some scholar</name></note></l>'
            "</body></text></TEI>"
        ).encode()

        self.assertEqual(build_name_index(xml), {})


class SurfaceFormTest(SimpleTestCase):
    def test_it_is_the_text_the_manuscript_spells_the_name_with(self):
        el = etree.fromstring('<name type="person" nymRef="F64">Find</name>')

        self.assertEqual(surface_form(el), "Find")

    def test_inline_markup_inside_the_name_is_still_the_name(self):
        el = etree.fromstring(
            '<name nymRef="T1">tal<expan>am</expan></name>'
        )

        self.assertEqual(surface_form(el), "talam")

    def test_a_nested_note_is_the_editor_talking_not_a_spelling(self):
        # One `e6` occurrence reads Ērinn<note>The MS has an instance of
        # dittography here…</note>. Taking the element's whole text would print
        # the editor's sentence in the Tag Filter menu.
        el = etree.fromstring(
            "<name>Ērinn<note>The MS has an instance of dittography here; I "
            "have retained only one 'Ērinn'.</note></name>"
        )

        self.assertEqual(surface_form(el), "Ērinn")

    def test_it_keeps_the_tail_that_follows_a_note_inside_the_name(self):
        el = etree.fromstring("<name>Find<note>Dot over d.</note> mac</name>")

        self.assertEqual(surface_form(el), "Find mac")

    def test_surrounding_whitespace_is_not_part_of_a_spelling(self):
        el = etree.fromstring("<name>\n  Find mac\n  Cumaill\n</name>")

        self.assertEqual(surface_form(el), "Find mac Cumaill")


class KindTest(SimpleTestCase):
    def test_the_group_is_whatever_it_was_tagged_most_often(self):
        self.assertEqual(kind_of({"place": 113, "person": 1}), "place")

    def test_a_group_the_corpus_never_typed_is_read_as_a_person(self):
        # No group in the corpus in hand is untyped throughout; this is the
        # degradation rule for one that is, not a claim about the text. TEI's
        # unqualified `name` is most often a personal name, and a row under
        # Person is recoverable — a row under nothing is not.
        self.assertEqual(kind_of({}), "person")

    def test_a_type_the_menu_has_no_group_for_does_not_decide_anything(self):
        self.assertEqual(kind_of({"fictional": 9, "place": 2}), "place")


class HeadwordTest(SimpleTestCase):
    def test_it_is_the_spelling_the_document_uses_most(self):
        self.assertEqual(
            headword_of({"Find": 17, "Find mac Cumaill meic Trēnmóir": 2}),
            "Find",
        )

    def test_a_tie_goes_to_whichever_came_first_in_the_document(self):
        self.assertEqual(headword_of({"Oisīn": 1, "Oiséin": 1}), "Oisīn")

    def test_a_group_with_nothing_to_print_has_no_headword(self):
        self.assertIsNone(headword_of({}))


class AnchorIdsAgreeWithTheParserTest(SimpleTestCase):
    """`build_name_index` allocates anchor ids by its own walk of the tree; the
    parser allocates them in `_flatten`. They have to agree, or the ids the
    index records point at somebody else's element."""

    def test_the_two_walks_visit_the_same_elements_in_the_same_order(self):
        for path in sorted(CORPUS.glob("*.xml")):
            with self.subTest(path.name):
                _, anchors, _ = parse_tei(path.read_bytes())
                elements = anchor_elements(etree.fromstring(path.read_bytes()))

                self.assertEqual(len(elements), len(anchors))
                self.assertEqual(
                    [el.tag.split("}")[-1] for el in elements],
                    [anchor["tag"] for anchor in anchors],
                )


class RealCorpusTest(SimpleTestCase):
    """The numbers issue #163 states, read back off the four witnesses in hand.

    They are pinned so that a re-cut corpus which fixes the tagging slips — or
    breaks new ones — is noticed here rather than in the menu.
    """

    def indexes(self):
        return {p.name: build_name_index(p.read_bytes()) for p in ACALLAM}

    def test_the_four_witnesses_group_their_names_under_91_ids(self):
        codes = set()
        for index in self.indexes().values():
            codes |= set(index)

        self.assertEqual(len(codes), 91)

    def test_find_is_one_man_spelled_four_ways(self):
        counts = {
            name.split("_")[-1].removesuffix(".tei.xml"): index["F64"]["count"]
            for name, index in self.indexes().items()
        }

        self.assertEqual(
            counts,
            {"FranA4": 21, "G126": 10, "Laud610": 17, "Lis204": 16},
        )

    def test_the_mistyped_id_in_lismore_is_a_group_of_one(self):
        index = self.indexes()["AcS_2390-2594_Lis204.tei.xml"]

        self.assertEqual(index["64"]["count"], 1)

    def test_the_six_ids_written_as_n_join_no_group(self):
        # Feradach IS a group — F21, 22 times across the four files. Six FURTHER
        # occurrences put the id in `@n` instead, and those six join nothing:
        # they stay visible in the text and are not navigable. Reading `@n` as a
        # group id would quietly inflate this group to 28.
        counts = {
            name.split("_")[-1].removesuffix(".tei.xml"): index["F21"]["count"]
            for name, index in self.indexes().items()
        }

        self.assertEqual(
            counts,
            {"FranA4": 6, "G126": 7, "Laud610": 4, "Lis204": 5},
        )

    def test_a_name_carrying_only_n_is_in_the_document_but_in_no_group(self):
        # The guard above only bites while these six are actually in the files.
        strays = 0
        for path in ACALLAM:
            root = etree.fromstring(path.read_bytes())
            for el in root.iter("{*}name", "{*}addName"):
                if el.get("nymRef") is None and el.get("n") == "F21":
                    strays += 1

        self.assertEqual(strays, 6)

    def test_franciscan_a4_spells_the_headwords_the_issue_expects(self):
        index = self.indexes()["AcS_2390-2594_FranA4.tei.xml"]

        self.assertEqual(
            {
                code: headword_of(index[code]["variants"])
                for code in ("F64", "e6", "O2", "C6")
            },
            {"F64": "Find", "e6": "Érend", "O2": "Oisīn", "C6": "Caílti"},
        )

    def test_eriu_is_a_place_the_annotators_typed_person_once(self):
        types = {}
        for index in self.indexes().values():
            for kind, n in index["e6"]["types"].items():
                types[kind] = types.get(kind, 0) + n

        self.assertEqual(types, {"place": 113, "person": 1})
        self.assertEqual(kind_of(types), "place")
