from rest_framework.test import APITestCase
from apps.tei.models import TEIDocument, Work


class TEIListDetailTests(APITestCase):
    def setUp(self):
        self.parsed = TEIDocument.objects.create(
            title="Parsed", language="ga", parsed_json={"tag": "TEI"})
        self.unparsed = TEIDocument.objects.create(
            title="Unparsed", language="ga", parsed_json=None)   # excluded from list

    def test_list_returns_only_parsed_documents(self):
        resp = self.client.get("/api/tei/")
        self.assertEqual(resp.status_code, 200)
        ids = [d["id"] for d in resp.data]
        self.assertIn(self.parsed.id, ids)
        self.assertNotIn(self.unparsed.id, ids)

    def test_detail_returns_404_for_nonexistent_id(self):
        resp = self.client.get("/api/tei/999999/")
        self.assertEqual(resp.status_code, 404)


class TEIWorkFieldTests(APITestCase):
    """The catalogue carries each document's Work, because that is the only
    thing the two-level opener can group the flat list by (#152)."""

    def setUp(self):
        # The Acallam work itself is created by migration 0006, so this uses a
        # second one — the feature is not about that one row.
        self.work = Work.objects.create(name="Táin Bó Cúailnge")
        self.assigned = TEIDocument.objects.create(
            title="Book of Leinster", language="ga",
            parsed_json={"tag": "TEI"}, work=self.work)
        self.unassigned = TEIDocument.objects.create(
            title="Shakespeare", language="en", parsed_json={"tag": "TEI"})

    def entry(self, resp, doc):
        return next(d for d in resp.data if d["id"] == doc.id)

    def test_list_nests_the_work_of_an_assigned_document(self):
        resp = self.client.get("/api/tei/")
        self.assertEqual(
            self.entry(resp, self.assigned)["work"],
            {"id": self.work.id, "name": "Táin Bó Cúailnge",
             "slug": "tain-bo-cuailnge"},
        )

    def test_list_reports_an_unassigned_document_as_work_null(self):
        # null, not omitted: a document with no work is still openable, so the
        # frontend has to be able to tell "no work" from "field missing".
        resp = self.client.get("/api/tei/")
        self.assertIsNone(self.entry(resp, self.unassigned)["work"])

    def test_detail_nests_the_work_too(self):
        # The Tag Filter narrows on the OPEN documents, which come from here.
        resp = self.client.get(f"/api/tei/{self.assigned.id}/")
        self.assertEqual(resp.data["work"]["slug"], "tain-bo-cuailnge")

    def test_deleting_a_work_keeps_its_documents(self):
        self.work.delete()
        self.assigned.refresh_from_db()
        self.assertIsNone(self.assigned.work)


class WorkModelTests(APITestCase):
    def test_migration_seeds_the_acallam_work(self):
        # A fresh database still offers the corpus's own work in the opener;
        # which documents belong to it is an admin's call, not the migration's.
        work = Work.objects.get(slug="acallam-na-senorach")
        self.assertEqual(work.name, "Acallam na Senórach")

    def test_slug_is_derived_from_the_name_when_left_blank(self):
        # Admin creates a work inline from the TEI upload form, where typing a
        # slug by hand is a step nobody should have to take.
        work = Work.objects.create(name="Táin Bó Cúailnge")
        self.assertEqual(work.slug, "tain-bo-cuailnge")

    def test_explicit_slug_is_kept(self):
        work = Work.objects.create(name="Saltair na Rann", slug="saltair")
        self.assertEqual(work.slug, "saltair")