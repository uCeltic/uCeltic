"""What the Tag Filter menu is built from (#163).

Two halves, deliberately fetched separately. The register says what a group id
NAMES — a corpus-wide fact, the same whatever is on screen — and each document's
`name_index` says how often IT writes that name. The menu is the join, made on
the frontend, because that is where `getVisibleTEIDocuments` already decides
which columns are in play and a chosen Work already narrows them.
"""
from rest_framework.test import APITestCase

from apps.tei.models import NameEntity, TEIDocument


class NameEntityListTests(APITestCase):
    def setUp(self):
        NameEntity.objects.create(code="F64", kind="person", headword="Find")
        NameEntity.objects.create(code="e6", kind="place", headword="Érend")

    def test_it_lists_the_register(self):
        resp = self.client.get("/api/tei/names/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            sorted((e["code"], e["kind"], e["headword"]) for e in resp.data),
            [("F64", "person", "Find"), ("e6", "place", "Érend")],
        )

    def test_the_code_is_carried_because_it_is_what_the_menu_prints_beside_the_name(self):
        # Researchers cross-check against their own person_name_list.csv /
        # place_name_list.csv, and the `@nymRef` code is the only key those
        # lists share with the app.
        resp = self.client.get("/api/tei/names/")

        self.assertTrue(all("code" in entry for entry in resp.data))

    def test_it_is_readable_without_an_account(self):
        # The workspace is fully usable anonymously (ADR-0004), and a menu the
        # reader cannot see makes the columns unfollowable.
        self.assertEqual(self.client.get("/api/tei/names/").status_code, 200)

    def test_an_empty_register_is_an_empty_list_not_an_error(self):
        NameEntity.objects.all().delete()

        resp = self.client.get("/api/tei/names/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(list(resp.data), [])


class DocumentCarriesItsNameIndexTests(APITestCase):
    def setUp(self):
        self.document = TEIDocument.objects.create(
            title="Franciscan A 4",
            parsed_json={"tag": "TEI"},
            name_index={
                "F64": {
                    "count": 21,
                    "types": {"person": 21},
                    "variants": {"Find": 17},
                    "anchors": [143, 287],
                },
            },
        )

    def test_the_detail_carries_the_document_s_own_counts(self):
        # The per-column count the menu prints (`21 · 10 · 17 · 16`) is this
        # document's claim about itself, so it travels with the document rather
        # than being asked for separately every time a column opens or closes.
        resp = self.client.get(f"/api/tei/{self.document.id}/")

        self.assertEqual(resp.data["name_index"]["F64"]["count"], 21)

    def test_a_document_parsed_before_the_registry_reports_no_names(self):
        # Rows uploaded before #163 have no index until `reparse_tei` runs. The
        # menu has to read that as "this column names nobody", not crash.
        TEIDocument.objects.filter(pk=self.document.pk).update(name_index=None)

        resp = self.client.get(f"/api/tei/{self.document.id}/")

        self.assertIsNone(resp.data["name_index"])
