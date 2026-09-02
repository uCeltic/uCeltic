"""Capturing a signed-in user's search as an immutable snapshot (#187, ADR-0024)."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.history.models import MAX_ENTRIES_PER_USER, SearchHistoryEntry

SEARCH_HISTORY = "/api/search-history/"

EMAIL = "reader@example.com"
PASSWORD = "correct-horse-battery-staple"

User = get_user_model()


def _payload(**overrides):
    payload = {
        "query": "ro gab in ri",
        "query_origin": "typed",
        "window_size_ratio": 1.3,
        "step_size": 1,
        "dissimilarity_threshold": 0.5,
        "top_k": 10,
        "versions": [
            {
                "title": "Lebor na hUidre",
                "hits": [
                    {"snippet": "ro gab in ri cetus", "score": 0.12},
                    {"snippet": "gabais in ri", "score": 0.41},
                ],
            },
            {"title": "The Yellow Book of Lecan", "hits": []},
        ],
    }
    payload.update(overrides)
    return payload


class CaptureTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reader", email=EMAIL, password=PASSWORD
        )
        self.client.force_login(self.user)

    def test_a_settled_search_is_stored_whole(self):
        resp = self.client.post(
            SEARCH_HISTORY, _payload(), content_type="application/json"
        )

        self.assertEqual(resp.status_code, 201)
        entry = SearchHistoryEntry.objects.get()
        self.assertEqual(entry.user, self.user)
        self.assertEqual(entry.query, "ro gab in ri")
        self.assertEqual(entry.query_origin, "typed")
        self.assertEqual(entry.window_size_ratio, 1.3)
        self.assertEqual(entry.step_size, 1)
        self.assertEqual(entry.dissimilarity_threshold, 0.5)
        self.assertEqual(entry.top_k, 10)
        self.assertIsNotNone(entry.created_at)
        self.assertEqual(
            entry.versions,
            [
                {
                    "title": "Lebor na hUidre",
                    "hits": [
                        {"snippet": "ro gab in ri cetus", "score": 0.12},
                        {"snippet": "gabais in ri", "score": 0.41},
                    ],
                },
                {"title": "The Yellow Book of Lecan", "hits": []},
            ],
        )

    def test_a_selection_search_records_its_origin(self):
        resp = self.client.post(
            SEARCH_HISTORY,
            _payload(query_origin="selection"),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(SearchHistoryEntry.objects.get().query_origin, "selection")

    def test_a_zero_hit_column_is_kept(self):
        resp = self.client.post(
            SEARCH_HISTORY,
            _payload(versions=[{"title": "Lebor na hUidre", "hits": []}]),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(
            SearchHistoryEntry.objects.get().versions,
            [{"title": "Lebor na hUidre", "hits": []}],
        )

    def test_a_search_with_no_returning_column_is_not_stored(self):
        resp = self.client.post(
            SEARCH_HISTORY, _payload(versions=[]), content_type="application/json"
        )

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(SearchHistoryEntry.objects.count(), 0)

    def test_the_entry_carries_no_reference_to_a_tei_document(self):
        field_names = {f.name for f in SearchHistoryEntry._meta.get_fields()}

        self.assertNotIn("document", field_names)
        for field in SearchHistoryEntry._meta.get_fields():
            related = getattr(field, "related_model", None)
            if related is not None:
                self.assertNotEqual(related._meta.app_label, "tei")

    def test_a_blank_query_is_not_a_search(self):
        resp = self.client.post(
            SEARCH_HISTORY, _payload(query="   "), content_type="application/json"
        )

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(SearchHistoryEntry.objects.count(), 0)

    def test_an_unknown_origin_is_rejected(self):
        resp = self.client.post(
            SEARCH_HISTORY,
            _payload(query_origin="retry"),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(SearchHistoryEntry.objects.count(), 0)

    def test_a_client_supplied_user_is_ignored(self):
        other = User.objects.create_user(
            username="other", email="other@example.com", password=PASSWORD
        )

        resp = self.client.post(
            SEARCH_HISTORY, _payload(user=other.pk), content_type="application/json"
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(SearchHistoryEntry.objects.get().user, self.user)


    def test_an_oversized_snapshot_is_refused(self):
        """The length guards are the whole abuse defense on this endpoint, so they have
        to actually bite — a real workspace never comes near them."""
        too_many_columns = _payload(
            versions=[{"title": f"Version {i}", "hits": []} for i in range(9)]
        )
        too_many_hits = _payload(
            versions=[
                {
                    "title": "Lebor na hUidre",
                    "hits": [{"snippet": "ro gab", "score": 0.1}] * 101,
                }
            ]
        )
        too_long_a_query = _payload(query="a" * 4001)

        for payload in (too_many_columns, too_many_hits, too_long_a_query):
            resp = self.client.post(
                SEARCH_HISTORY, payload, content_type="application/json"
            )
            self.assertEqual(resp.status_code, 400)
        self.assertEqual(SearchHistoryEntry.objects.count(), 0)


class AnonymousTests(TestCase):
    def test_an_anonymous_search_stores_nothing(self):
        resp = self.client.post(
            SEARCH_HISTORY, _payload(), content_type="application/json"
        )

        self.assertIn(resp.status_code, (401, 403))
        self.assertEqual(SearchHistoryEntry.objects.count(), 0)


class RollingCapTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reader", email=EMAIL, password=PASSWORD
        )

    def _capture(self, query):
        return SearchHistoryEntry.objects.capture(
            user=self.user,
            query=query,
            query_origin="typed",
            window_size_ratio=1.3,
            step_size=1,
            dissimilarity_threshold=0.5,
            top_k=10,
            versions=[{"title": "Lebor na hUidre", "hits": []}],
        )

    def test_only_the_fifty_most_recent_are_kept_and_the_oldest_is_dropped(self):
        for i in range(MAX_ENTRIES_PER_USER + 1):
            self._capture(f"search {i}")

        queries = list(
            SearchHistoryEntry.objects.filter(user=self.user).values_list(
                "query", flat=True
            )
        )
        self.assertEqual(len(queries), MAX_ENTRIES_PER_USER)
        self.assertNotIn("search 0", queries)
        self.assertIn("search 1", queries)
        self.assertIn(f"search {MAX_ENTRIES_PER_USER}", queries)

    def test_the_cap_is_per_user(self):
        other = User.objects.create_user(
            username="other", email="other@example.com", password=PASSWORD
        )
        for i in range(MAX_ENTRIES_PER_USER):
            self._capture(f"mine {i}")
        SearchHistoryEntry.objects.capture(
            user=other,
            query="theirs",
            query_origin="typed",
            window_size_ratio=1.3,
            step_size=1,
            dissimilarity_threshold=0.5,
            top_k=10,
            versions=[{"title": "Lebor na hUidre", "hits": []}],
        )

        self.assertEqual(
            SearchHistoryEntry.objects.filter(user=self.user).count(),
            MAX_ENTRIES_PER_USER,
        )
        self.assertEqual(SearchHistoryEntry.objects.filter(user=other).count(), 1)


class SurvivesTheCorpusTests(TestCase):
    """The point of freezing the Version title as text (ADR-0024): the entry outlives
    the Document it was captured from."""

    def test_an_entry_is_whole_after_its_document_is_renamed_then_deleted(self):
        from apps.tei.models import TEIDocument

        user = User.objects.create_user(
            username="reader", email=EMAIL, password=PASSWORD
        )
        document = TEIDocument.objects.create(
            title="Lebor na hUidre", xml_file="tei/lu.xml"
        )
        entry = SearchHistoryEntry.objects.capture(
            user=user,
            query="ro gab in ri",
            query_origin="typed",
            window_size_ratio=1.3,
            step_size=1,
            dissimilarity_threshold=0.5,
            top_k=10,
            versions=[
                {"title": document.title, "hits": [{"snippet": "ro gab", "score": 0.1}]}
            ],
        )

        document.title = "Book of the Dun Cow"
        document.save()
        document.delete()

        entry.refresh_from_db()
        self.assertEqual(entry.versions[0]["title"], "Lebor na hUidre")
        self.assertEqual(entry.versions[0]["hits"], [{"snippet": "ro gab", "score": 0.1}])
