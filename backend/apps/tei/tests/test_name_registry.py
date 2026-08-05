"""Uploading a manuscript registers the people and places it names (#163).

The register is what makes `F64` sayable. The corpus groups 670 named entities
under 91 ids and never says what one stands for, so until something outside the
TEI supplies a name for a group there is nothing a reader can be offered. These
tests are about that register staying honest as documents come and go — and, in
particular, about a document being re-uploadable, which is the reason the
per-document `name_index` and the corpus-wide `NameEntity` are two things.
"""
import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.tei.models import NameEntity, TEIDocument

CORPUS = Path(__file__).resolve().parents[3] / "tei"
WITNESSES = {
    "FranA4": CORPUS / "AcS_2390-2594_FranA4.tei.xml",
    "G126": CORPUS / "AcS_2390-2458_G126.tei.xml",
    "Laud610": CORPUS / "AcS_2390-2594_Laud610.tei.xml",
    "Lis204": CORPUS / "AcS_2390-2594_Lis204.tei.xml",
}


def tei(body: str) -> bytes:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>'
        f"{body}"
        "</body></text></TEI>"
    ).encode()


def upload(title: str, xml: bytes) -> TEIDocument:
    return TEIDocument.objects.create(
        title=title, xml_file=SimpleUploadedFile(f"{title}.xml", xml),
    )


# An uploaded file is written to MEDIA_ROOT for real, so the tests get a
# throwaway one rather than leaving XML behind in the repo's media directory.
@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class UploadRegistersNamesTest(TestCase):
    def test_a_document_records_its_own_names_as_it_is_parsed(self):
        document = upload("acallam", tei(
            '<l><name type="person" nymRef="F64">Find</name></l>'
        ))

        document.refresh_from_db()
        self.assertEqual(document.name_index["F64"]["count"], 1)

    def test_the_names_it_records_become_entities_of_the_corpus(self):
        upload("acallam", tei(
            '<l><name type="person" nymRef="F64">Find</name>'
            '<name type="place" nymRef="e6">Érend</name></l>'
        ))

        self.assertEqual(
            sorted(NameEntity.objects.values_list("code", "kind", "headword")),
            [("F64", "person", "Find"), ("e6", "place", "Érend")],
        )

    def test_a_document_that_groups_no_name_contributes_nothing_and_raises_nothing(self):
        document = upload("shakespear", tei("<l>To be or not to be</l>"))

        document.refresh_from_db()
        self.assertEqual(document.name_index, {})
        self.assertEqual(NameEntity.objects.count(), 0)

    def test_a_headword_is_the_spelling_that_document_uses_most(self):
        upload("acallam", tei(
            '<l><name type="person" nymRef="F64">Find</name>'
            '<name type="person" nymRef="F64">Find</name>'
            '<name type="person" nymRef="F64">Finn</name></l>'
        ))

        self.assertEqual(NameEntity.objects.get(code="F64").headword, "Find")

    def test_a_group_with_nothing_printable_gets_no_row(self):
        upload("acallam", tei('<l><name type="person" nymRef="X9"/></l>'))

        self.assertFalse(NameEntity.objects.filter(code="X9").exists())


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ReUploadingIsIdempotentTest(TestCase):
    """A document must be re-uploadable without double-counting — which is the
    reason `name_index` is replaced wholesale and the register aggregated from
    the stored indexes rather than incremented per upload."""

    def test_saving_the_same_document_three_times_changes_no_count(self):
        document = upload("acallam", tei(
            '<l><name type="person" nymRef="F64">Find</name>'
            '<name type="person" nymRef="F64">Finn</name></l>'
        ))

        for _ in range(3):
            document.save()

        document.refresh_from_db()
        self.assertEqual(document.name_index["F64"]["count"], 2)
        self.assertEqual(NameEntity.objects.filter(code="F64").count(), 1)

    def test_a_reparse_takes_back_what_the_previous_parse_contributed(self):
        # The file behind the document is corrected: e6 was mistagged `person`
        # here, and the fix has to be able to flip the kind back.
        document = upload("acallam", tei(
            '<l><name type="person" nymRef="e6">Érend</name></l>'
        ))
        self.assertEqual(NameEntity.objects.get(code="e6").kind, "person")

        document.xml_file = SimpleUploadedFile("fixed.xml", tei(
            '<l><name type="place" nymRef="e6">Érend</name></l>'
        ))
        document.save()

        self.assertEqual(NameEntity.objects.get(code="e6").kind, "place")


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class KindFollowsTheCorpusTest(TestCase):
    def test_a_minority_mistagging_does_not_split_or_flip_a_group(self):
        # `e6` is Ériu: tagged `place` 113 times and `person` once across the
        # four witnesses. The odd one is a slip in the research files, not a
        # second identity.
        upload("mistagged", tei(
            '<l><name type="person" nymRef="e6">Érend</name></l>'
        ))
        upload("the-rest", tei(
            '<l><name type="place" nymRef="e6">Érend</name>'
            '<name type="place" nymRef="e6">Érind</name></l>'
        ))

        entity = NameEntity.objects.get(code="e6")
        self.assertEqual(entity.kind, "place")
        self.assertEqual(NameEntity.objects.filter(code="e6").count(), 1)

    def test_case_never_merges_a_man_and_a_hillfort(self):
        upload("acallam", tei(
            '<l><name type="person" nymRef="A13">Aed</name>'
            '<name type="place" nymRef="a13">Almu</name></l>'
        ))

        self.assertEqual(
            sorted(NameEntity.objects.values_list("code", "kind")),
            [("A13", "person"), ("a13", "place")],
        )


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class HeadwordIsFixedOnFirstSightingTest(TestCase):
    def test_a_later_manuscript_never_renames_an_entity(self):
        # Franciscan A 4 writes Find; G 126 writes Fionn more often than
        # anything else. Whoever got there first names the group, or a
        # researcher who has learned to recognise one row finds a different one.
        upload("FranA4", tei(
            '<l><name type="person" nymRef="F64">Find</name>'
            '<name type="person" nymRef="F64">Find</name></l>'
        ))

        upload("G126", tei(
            '<l><name type="person" nymRef="F64">Fionn</name>'
            '<name type="person" nymRef="F64">Fionn</name>'
            '<name type="person" nymRef="F64">Fionn</name></l>'
        ))

        self.assertEqual(NameEntity.objects.get(code="F64").headword, "Find")

    def test_a_headword_set_by_hand_survives_any_later_upload(self):
        upload("FranA4", tei(
            '<l><name type="person" nymRef="F64">Find</name></l>'
        ))
        NameEntity.objects.filter(code="F64").update(
            headword="Find mac Cumaill", headword_source=NameEntity.MANUAL,
        )

        upload("Lis204", tei(
            '<l><name type="person" nymRef="F64">Finn</name>'
            '<name type="person" nymRef="F64">Finn</name></l>'
        ))

        entity = NameEntity.objects.get(code="F64")
        self.assertEqual(entity.headword, "Find mac Cumaill")
        self.assertEqual(entity.headword_source, NameEntity.MANUAL)

    def test_a_derived_headword_says_so(self):
        upload("FranA4", tei(
            '<l><name type="person" nymRef="F64">Find</name></l>'
        ))

        self.assertEqual(
            NameEntity.objects.get(code="F64").headword_source,
            NameEntity.DERIVED,
        )


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class TheFourWitnessesTest(TestCase):
    """The register the corpus in hand actually produces."""

    @classmethod
    def setUpTestData(cls):
        # FranA4 first, because it is the witness whose spellings issue #163
        # states as the expected headwords.
        for title in ("FranA4", "G126", "Laud610", "Lis204"):
            upload(title, WITNESSES[title].read_bytes())

    def test_the_four_files_yield_91_entities_73_person_and_18_place(self):
        self.assertEqual(NameEntity.objects.count(), 91)
        self.assertEqual(NameEntity.objects.filter(kind="person").count(), 73)
        self.assertEqual(NameEntity.objects.filter(kind="place").count(), 18)

    def test_eriu_is_a_place_despite_one_person_occurrence(self):
        self.assertEqual(NameEntity.objects.get(code="e6").kind, "place")

    def test_the_headwords_come_from_the_witness_that_introduced_them(self):
        self.assertEqual(
            dict(
                NameEntity.objects.filter(
                    code__in=["F64", "e6", "O2", "C6"],
                ).values_list("code", "headword")
            ),
            {"F64": "Find", "e6": "Érend", "O2": "Oisīn", "C6": "Caílti"},
        )

    def test_a_note_wedged_inside_a_name_is_not_part_of_the_spelling(self):
        # The two occurrences in the corpus that wrap a `note` inside the name
        # itself. Lismore writes `Trēnmhōr<note><p>Dúch caite</p></note> ūa
        # Baīscne` and Franciscan A 4 `Conn<note><p>LS cónn.</p></note>
        # Cétcathach` — taking the element's whole text would print the
        # palaeographer's remark in the Tag Filter menu, and the tail after the
        # note is manuscript text that must not be dropped with it.
        variants = {}
        for index in TEIDocument.objects.values_list("name_index", flat=True):
            for code in ("T13", "C86"):
                variants.setdefault(code, set()).update(index.get(code, {}).get("variants", {}))

        self.assertIn("Trēnmhōr ūa Baīscne", variants["T13"])
        self.assertIn("Conn Cétcathach", variants["C86"])
        self.assertFalse(
            [form for forms in variants.values() for form in forms
             if "Dúch caite" in form or "LS cónn" in form],
        )

    def test_the_mistyped_id_gets_its_own_row_rather_than_being_corrected(self):
        # Lismore writes nymRef="64" once where it writes F64 sixteen times.
        # Two near-identical rows are the signal to fix the source file.
        self.assertEqual(NameEntity.objects.get(code="64").headword, "Ḟinn")
        self.assertEqual(NameEntity.objects.get(code="F64").headword, "Find")

    def test_reuploading_every_witness_leaves_the_register_unchanged(self):
        before = sorted(
            NameEntity.objects.values_list("code", "kind", "headword")
        )

        for document in TEIDocument.objects.all():
            document.save()
            document.save()

        self.assertEqual(
            sorted(NameEntity.objects.values_list("code", "kind", "headword")),
            before,
        )
