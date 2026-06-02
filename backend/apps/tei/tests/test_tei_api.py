from rest_framework.test import APITestCase
from apps.tei.models import TEIDocument


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