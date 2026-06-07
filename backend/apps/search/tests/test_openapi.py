from rest_framework.test import APITestCase


class OpenAPISchemaTests(APITestCase):
    def test_schema_documents_search_request_parameters(self):
        resp = self.client.get("/api/schema/")
        self.assertEqual(resp.status_code, 200)
        body = resp.content.decode()
        # the search endpoint and its bounded parameters must appear in the schema
        self.assertIn("/api/search/", body)
        self.assertIn("window_size_ratio", body)
        self.assertIn("dissimilarity_threshold", body)

    
    def test_schema_documents_search_response_fields(self):
        resp = self.client.get("/api/schema/")
        body = resp.content.decode()
        # the result objects' fields must be documented in the response schema
        self.assertIn("snippet", body)
        self.assertIn("score", body)

    def test_swagger_ui_is_served(self):
        resp = self.client.get("/api/docs/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("swagger", resp.content.decode().lower())