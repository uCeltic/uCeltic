"""A captured entry in the admin: read-only, and never showing the email-derived
username (#69, #187)."""
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from django.urls import reverse

from apps.accounts.admin_user_display import UserListFilter
from apps.accounts.models import Profile
from apps.history.admin import SearchHistoryEntryAdmin
from apps.history.models import SearchHistoryEntry

User = get_user_model()


def _make_entry(user, **overrides):
    fields = {
        "user": user,
        "query": "ro gab in ri",
        "query_origin": "typed",
        "window_size_ratio": 1.3,
        "step_size": 1,
        "dissimilarity_threshold": 0.5,
        "top_k": 10,
        "versions": [{"title": "Lebor na hUidre", "hits": []}],
    }
    fields.update(overrides)
    return SearchHistoryEntry.objects.create(**fields)


class SearchHistoryAdminTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reader", email="reader@example.com", password="x"
        )
        self.admin = SearchHistoryEntryAdmin(SearchHistoryEntry, admin.site)

    def test_a_snapshot_cannot_be_authored_or_edited(self):
        request = RequestFactory().get("/")
        self.assertFalse(self.admin.has_add_permission(request))
        self.assertFalse(self.admin.has_change_permission(request))

    def test_the_owner_reads_as_a_display_name_not_a_username(self):
        Profile.objects.update_or_create(
            user=self.user, defaults={"display_name": "A Reader"}
        )
        entry = _make_entry(self.user)

        self.assertEqual(self.admin.user_display(entry), "A Reader")

    def test_the_owner_falls_back_to_a_non_identifying_label(self):
        entry = _make_entry(self.user)

        self.assertEqual(self.admin.user_display(entry), f"user #{self.user.pk}")

    def test_the_owner_is_filtered_by_display_name_too(self):
        self.assertIn(UserListFilter, self.admin.list_filter)

    def test_the_list_page_does_not_print_what_the_user_searched_for(self):
        self.assertNotIn("query", self.admin.list_display)

    def test_the_change_page_shows_no_username(self):
        staff = User.objects.create_superuser(
            username="staff", email="staff@example.com", password="x"
        )
        entry = _make_entry(self.user)
        self.client.force_login(staff)

        response = self.client.get(
            reverse("admin:history_searchhistoryentry_change", args=[entry.pk])
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, self.user.username)
