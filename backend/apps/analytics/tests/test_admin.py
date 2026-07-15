"""Study data in Django admin: read-only, filterable, no raw email exposure (#69)."""
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import Profile
from apps.analytics.admin import BehaviorEventAdmin, QuestionnaireResponseAdmin
from apps.analytics.models import BehaviorEvent, QuestionnaireResponse

User = get_user_model()


class AdminConfigTests(TestCase):
    """Acceptance criteria are literal list_display/list_filter/search_fields shapes."""

    def test_behavior_event_admin_columns_and_filters(self):
        self.assertEqual(
            BehaviorEventAdmin.list_display, ("server_ts", "event_type", "user_display", "session_id")
        )
        self.assertEqual(BehaviorEventAdmin.list_filter, ("user", "event_type"))
        self.assertEqual(BehaviorEventAdmin.search_fields, ("session_id",))

    def test_questionnaire_response_admin_filters(self):
        self.assertEqual(QuestionnaireResponseAdmin.list_filter, ("user", "skipped"))


class UserDisplayTests(TestCase):
    """Admin list pages show a display name, not the user's email/username (#69 AC4)."""

    def setUp(self):
        self.site = admin.site
        self.user = User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )

    def test_behavior_event_shows_display_name_when_set(self):
        Profile.objects.create(user=self.user, display_name="Ada")
        event = BehaviorEvent.objects.create(
            session_id="s1", event_type="session_started", client_ts="2026-07-07T10:00:00Z", app_version="0.0.1",
            user=self.user,
        )

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), "Ada")

    def test_behavior_event_falls_back_when_display_name_is_empty(self):
        Profile.objects.create(user=self.user, display_name="")
        event = BehaviorEvent.objects.create(
            session_id="s1", event_type="session_started", client_ts="2026-07-07T10:00:00Z", app_version="0.0.1",
            user=self.user,
        )

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), f"user #{self.user.pk}")

    def test_behavior_event_falls_back_when_profile_row_is_missing(self):
        # Users created before #66's signal existed have no Profile row at all.
        self.assertFalse(Profile.objects.filter(user=self.user).exists())
        event = BehaviorEvent.objects.create(
            session_id="s1", event_type="session_started", client_ts="2026-07-07T10:00:00Z", app_version="0.0.1",
            user=self.user,
        )

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), f"user #{self.user.pk}")

    def test_behavior_event_shows_dash_for_anonymous_traffic(self):
        event = BehaviorEvent.objects.create(
            session_id="s1", event_type="session_started", client_ts="2026-07-07T10:00:00Z", app_version="0.0.1",
            user=None,
        )

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), "—")

    def test_questionnaire_response_shows_display_name(self):
        Profile.objects.create(user=self.user, display_name="Ada")
        response = QuestionnaireResponse.objects.create(
            user=self.user, session_id="s1", questionnaire_version=1, skipped=True
        )

        qa = QuestionnaireResponseAdmin(QuestionnaireResponse, self.site)

        self.assertEqual(qa.user_display(response), "Ada")


class ReadOnlyPermissionTests(TestCase):
    """Collected study data: viewable, never addable or editable (#69 AC1/AC2)."""

    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="pw-12345678"
        )
        self.client.login(username="admin", password="pw-12345678")
        self.subject = User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )
        self.event = BehaviorEvent.objects.create(
            session_id="s1", event_type="session_started", client_ts="2026-07-07T10:00:00Z", app_version="0.0.1",
            user=self.subject,
        )
        self.response = QuestionnaireResponse.objects.create(
            user=self.subject, session_id="s1", questionnaire_version=1, skipped=True
        )

    def test_behavior_event_add_is_forbidden(self):
        resp = self.client.get(reverse("admin:analytics_behaviorevent_add"))
        self.assertEqual(resp.status_code, 403)

    def test_behavior_event_changelist_has_no_add_permission(self):
        resp = self.client.get(reverse("admin:analytics_behaviorevent_changelist"))
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["has_add_permission"])

    def test_behavior_event_change_view_is_read_only_not_forbidden(self):
        resp = self.client.get(
            reverse("admin:analytics_behaviorevent_change", args=[self.event.pk])
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["has_change_permission"])

    def test_questionnaire_response_add_is_forbidden(self):
        resp = self.client.get(reverse("admin:analytics_questionnaireresponse_add"))
        self.assertEqual(resp.status_code, 403)

    def test_questionnaire_response_change_view_is_read_only_not_forbidden(self):
        resp = self.client.get(
            reverse("admin:analytics_questionnaireresponse_change", args=[self.response.pk])
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["has_change_permission"])
