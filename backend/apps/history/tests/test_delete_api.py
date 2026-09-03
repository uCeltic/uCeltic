"""Removing entries from a signed-in user's own Search History (#189, ADR-0024)."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.history.models import SearchHistoryEntry

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
            }
        ],
    }
    fields.update(overrides)
    return SearchHistoryEntry.objects.capture(**fields)


class DeleteOneTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner", email="owner@example.com", password="correct-horse-1"
        )
        self.client.force_login(self.user)

    def test_an_entry_is_gone_after_deleting_it(self):
        entry = _entry(self.user)

        resp = self.client.delete(f"{SEARCH_HISTORY}{entry.pk}/")

        self.assertEqual(resp.status_code, 204)
        self.assertFalse(SearchHistoryEntry.objects.filter(pk=entry.pk).exists())

    def test_the_users_other_entries_are_left_alone(self):
        deleted = _entry(self.user, query="one")
        kept = _entry(self.user, query="two")

        self.client.delete(f"{SEARCH_HISTORY}{deleted.pk}/")

        self.assertEqual(
            list(SearchHistoryEntry.objects.values_list("pk", flat=True)), [kept.pk]
        )

    def test_another_users_entry_is_not_deletable(self):
        stranger = User.objects.create_user(
            username="stranger", email="stranger@example.com", password="correct-horse-2"
        )
        theirs = _entry(stranger)

        resp = self.client.delete(f"{SEARCH_HISTORY}{theirs.pk}/")

        # 404, not 403: whether an id exists at all is not this user's business, and the
        # answer would leak that someone else searched.
        self.assertEqual(resp.status_code, 404)
        self.assertTrue(SearchHistoryEntry.objects.filter(pk=theirs.pk).exists())

    def test_an_id_that_never_existed_is_a_404(self):
        resp = self.client.delete(f"{SEARCH_HISTORY}999999/")

        self.assertEqual(resp.status_code, 404)

    def test_an_anonymous_visitor_cannot_delete(self):
        entry = _entry(self.user)
        self.client.logout()

        resp = self.client.delete(f"{SEARCH_HISTORY}{entry.pk}/")

        self.assertEqual(resp.status_code, 403)
        self.assertTrue(SearchHistoryEntry.objects.filter(pk=entry.pk).exists())


class ClearAllTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner", email="owner@example.com", password="correct-horse-1"
        )
        self.client.force_login(self.user)

    def test_the_whole_history_is_gone_after_clearing_it(self):
        _entry(self.user, query="one")
        _entry(self.user, query="two")

        resp = self.client.delete(SEARCH_HISTORY)

        self.assertEqual(resp.status_code, 204)
        self.assertEqual(SearchHistoryEntry.objects.filter(user=self.user).count(), 0)

    def test_clearing_touches_nobody_elses_history(self):
        stranger = User.objects.create_user(
            username="stranger", email="stranger@example.com", password="correct-horse-2"
        )
        theirs = _entry(stranger)
        _entry(self.user)

        self.client.delete(SEARCH_HISTORY)

        self.assertEqual(
            list(SearchHistoryEntry.objects.values_list("pk", flat=True)), [theirs.pk]
        )

    def test_clearing_an_empty_history_still_succeeds(self):
        # Nothing to remove is not a failure: the user asked for an empty history and an
        # empty history is what they have.
        resp = self.client.delete(SEARCH_HISTORY)

        self.assertEqual(resp.status_code, 204)

    def test_an_anonymous_visitor_cannot_clear(self):
        _entry(self.user)
        self.client.logout()

        resp = self.client.delete(SEARCH_HISTORY)

        self.assertEqual(resp.status_code, 403)
        self.assertEqual(SearchHistoryEntry.objects.filter(user=self.user).count(), 1)
