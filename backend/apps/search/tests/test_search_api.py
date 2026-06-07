from rest_framework.test import APITestCase
from apps.tei.models import TEIDocument


class SearchEndpointTests(APITestCase):
    def setUp(self):
        # parsed doc with a tiny searchable word_array (exact match for "rex")
        self.doc = TEIDocument.objects.create(
            title="Test Doc",
            language="ga",
            parsed_json={"tag": "TEI"},                       # makes it "parsed"
            anchors=[{"id": "a1", "tag": "p", "parent_id": None, "line_no": 1}],
            word_array=[
                {"w": "rex", "sep": " ", "a": "a1"},
                {"w": "erat", "sep": " ", "a": "a1"},
            ],

        )

    def test_valid_query_returns_200_with_results_array(self):
        resp = self.client.post(
            "/api/search/",
            {"doc_id": self.doc.id, "query": "rex"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data["results"], list)
        self.assertGreaterEqual(len(resp.data["results"]), 1)


    def test_missing_param_returns_400_with_error(self):
          for payload in ({"query": "rex"}, {"doc_id": 1}):    # lack of doc_id / lack of query
              with self.subTest(payload=payload):
                  resp = self.client.post("/api/search/", payload, format="json")
                  self.assertEqual(resp.status_code, 400)
                  self.assertIn("error", resp.data)

    def test_unknown_doc_id_returns_404(self):
        resp = self.client.post(
            "/api/search/", {"doc_id": 999999, "query": "x"}, format="json")
        self.assertEqual(resp.status_code, 404)

    def test_malformed_numeric_param_returns_4xx_not_500(self):
        resp = self.client.post(
            "/api/search/", {"doc_id": "abc", "query": "x"}, format="json")
        self.assertGreaterEqual(resp.status_code, 400)
        self.assertLess(resp.status_code, 500)              # 今天这条 RED：返 500 


    # return 400 instead of 500 and error message if request with out of range parameter
    def test_out_of_range_param_returns_400(self):
          resp = self.client.post(
              "/api/search/",
              {"doc_id": self.doc.id, "query": "rex", "top_k": 0},
              format="json",
          )
          self.assertEqual(resp.status_code, 400)
          self.assertIn("error", resp.data)