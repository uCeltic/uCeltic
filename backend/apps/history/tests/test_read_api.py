"""Reading a signed-in user's own Search History (#188, ADR-0024)."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.history.models import MAX_ENTRIES_PER_USER, SearchHistoryEntry

SEARCH_HISTORY = "/api/search-history/"

User = get_user_model()


def _entry(user, **overrides):
    fields = {
        "user": user,
        "query": "ro gab in ri",
        "query_origin": "typed",
        "window_size_ratio": 1.3,
        "step_size": 1,
        "dissimilarity_threshold": 0.5,
        "top_k": 10,
        "versions": [
            {
                "title": "Lebor na hUidre",
                "hits": [{"snippet": "ro gab in ri cetus", "score": 0.12}],
            },
            {"title": "The Yellow Book of Lecan", "hits": []},
        ],
    }
    fields.update(overrides)
    return SearchHistoryEntry.objects.capture(**fields)


class ReadTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reader", email="reader@example.com", password="correct-horse-1"
        )
        self.client.force_login(self.user)

    def test_an_entry_is_returned_whole(self):
        _entry(self.user)

        resp = self.client.get(SEARCH_HISTORY)

        self.assertEqual(resp.status_code, 200)
        (body,) = resp.json()
        self.assertEqual(body["query"], "ro gab in ri")
        self.assertEqual(body["query_origin"], "typed")
        self.assertEqual(body["window_size_ratio"], 1.3)
        self.assertEqual(body["step_size"], 1)
        self.assertEqual(body["dissimilarity_threshold"], 0.5)
        self.assertEqual(body["top_k"], 10)
        self.assertEqual(
            body["versions"],
            [
                {
                    "title": "Lebor na hUidre",
                    "hits": [{"snippet": "ro gab in ri cetus", "score": 0.12}],
                },
                {"title": "The Yellow Book of Lecan", "hits": []},
            ],
        )
        self.assertIn("created_at", body)
        # The id is what a later delete (#189) or export (#190) addresses an entry by.
        self.assertIn("id", body)

    def test_the_score_stays_the_stored_dissimilarity(self):
        """Turning it into a match percentage is the reader's job, not the store's."""
        _entry(self.user, versions=[{"title": "A", "hits": [{"snippet": "x", "score": 0.2}]}])

        (body,) = self.client.get(SEARCH_HISTORY).json()

        self.assertEqual(body["versions"][0]["hits"][0]["score"], 0.2)

    def test_entries_come_back_newest_first(self):
        _entry(self.user, query="oldest")
        _entry(self.user, query="middle")
        _entry(self.user, query="newest")

        body = self.client.get(SEARCH_HISTORY).json()

        self.assertEqual([e["query"] for e in body], ["newest", "middle", "oldest"])

    def test_another_user_s_searches_are_not_shown(self):
        other = User.objects.create_user(
            username="other", email="other@example.com", password="correct-horse-2"
        )
        _entry(other, query="not mine")
        _entry(self.user, query="mine")

        body = self.client.get(SEARCH_HISTORY).json()

        self.assertEqual([e["query"] for e in body], ["mine"])

    def test_no_history_is_an_empty_list_not_an_error(self):
        resp = self.client.get(SEARCH_HISTORY)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_an_anonymous_visitor_reads_nothing(self):
        _entry(self.user)
        self.client.logout()

        self.assertEqual(self.client.get(SEARCH_HISTORY).status_code, 403)

    def test_at_most_the_most_recent_fifty_come_back(self):
        """The cap is what a user reads, whatever route put the rows there.

        `capture()` already trims, so this only bites for rows inserted around it — an
        admin, an import, a data migration. The read path bounds itself rather than
        trusting that every writer went through the manager.
        """
        for index in range(MAX_ENTRIES_PER_USER + 3):
            SearchHistoryEntry.objects.create(
                user=self.user,
                query=f"search {index}",
                query_origin="typed",
                window_size_ratio=1.3,
                step_size=1,
                dissimilarity_threshold=0.5,
                top_k=10,
                versions=[{"title": "A", "hits": []}],
            )

        body = self.client.get(SEARCH_HISTORY).json()

        self.assertEqual(len(body), MAX_ENTRIES_PER_USER)
        self.assertEqual(body[0]["query"], f"search {MAX_ENTRIES_PER_USER + 2}")
