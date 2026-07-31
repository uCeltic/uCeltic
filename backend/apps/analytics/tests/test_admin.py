"""Study data in Django admin: read-only, filterable, no raw email exposure (#69)."""
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from django.urls import reverse

from apps.accounts.models import Profile
from apps.analytics.admin import (
    BehaviorEventAdmin,
    ErrorReportAdmin,
    FeedbackAdmin,
    QuestionnaireResponseAdmin,
    UserListFilter,
)
from apps.analytics.models import BehaviorEvent, ErrorReport, Feedback, QuestionnaireResponse

User = get_user_model()


def _make_event(**overrides):
    fields = {
        "session_id": "s1",
        "event_type": "session_started",
        "client_ts": "2026-07-07T10:00:00Z",
        "app_version": "0.0.1",
    }
    fields.update(overrides)
    return BehaviorEvent.objects.create(**fields)


def _make_report(**overrides):
    fields = {
        "session_id": "s1",
        "kind": "backend_5xx",
        "summary": "RuntimeError: boom",
        "status_code": 500,
        "request_path": "/api/search/",
        "method": "POST",
        "context": {"query": "brigit"},
        "traceback": "Traceback (most recent call last): RuntimeError: boom",
        "fingerprint": "backend_5xx:RuntimeError:/api/search/",
    }
    fields.update(overrides)
    return ErrorReport.objects.create(**fields)


class AdminConfigTests(TestCase):
    """Acceptance criteria are literal list_display/list_filter/search_fields shapes."""

    def test_behavior_event_admin_columns_and_filters(self):
        self.assertEqual(
            BehaviorEventAdmin.list_display, ("server_ts", "event_type", "user_display", "session_id")
        )
        self.assertEqual(BehaviorEventAdmin.list_filter, (UserListFilter, "event_type"))
        self.assertEqual(BehaviorEventAdmin.search_fields, ("session_id",))

    def test_questionnaire_response_admin_filters(self):
        self.assertEqual(QuestionnaireResponseAdmin.list_filter, (UserListFilter, "skipped"))

    def test_error_report_admin_columns_and_filters(self):
        self.assertEqual(
            ErrorReportAdmin.list_display,
            ("server_ts", "kind", "status_code", "request_path", "user_display", "fingerprint"),
        )
        self.assertEqual(ErrorReportAdmin.list_filter, (UserListFilter, "kind", "status_code"))
        self.assertEqual(ErrorReportAdmin.search_fields, ("session_id", "fingerprint"))


class UserDisplayTests(TestCase):
    """Admin list pages show a display name, not the user's email/username (#69 AC4)."""

    def setUp(self):
        self.site = admin.site
        self.user = User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )

    def test_behavior_event_shows_display_name_when_set(self):
        Profile.objects.create(user=self.user, display_name="Ada")
        event = _make_event(user=self.user)

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), "Ada")

    def test_behavior_event_falls_back_when_display_name_is_empty(self):
        Profile.objects.create(user=self.user, display_name="")
        event = _make_event(user=self.user)

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), f"user #{self.user.pk}")

    def test_behavior_event_falls_back_when_profile_row_is_missing(self):
        # Users created before #66's signal existed have no Profile row at all.
        self.assertFalse(Profile.objects.filter(user=self.user).exists())
        event = _make_event(user=self.user)

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), f"user #{self.user.pk}")

    def test_behavior_event_shows_dash_for_anonymous_traffic(self):
        event = _make_event(user=None)

        ba = BehaviorEventAdmin(BehaviorEvent, self.site)

        self.assertEqual(ba.user_display(event), "—")

    def test_questionnaire_response_shows_display_name(self):
        Profile.objects.create(user=self.user, display_name="Ada")
        response = QuestionnaireResponse.objects.create(
            user=self.user, session_id="s1", questionnaire_version=1, skipped=True
        )

        qa = QuestionnaireResponseAdmin(QuestionnaireResponse, self.site)

        self.assertEqual(qa.user_display(response), "Ada")

    def test_error_report_shows_display_name(self):
        Profile.objects.create(user=self.user, display_name="Ada")
        report = _make_report(user=self.user)

        ea = ErrorReportAdmin(ErrorReport, self.site)

        self.assertEqual(ea.user_display(report), "Ada")

    def test_error_report_shows_dash_for_anonymous_traffic(self):
        report = _make_report(user=None)

        ea = ErrorReportAdmin(ErrorReport, self.site)

        self.assertEqual(ea.user_display(report), "—")


class ErrorReportStrTests(TestCase):
    """Same #69 leak class as QuestionnaireResponse below: __str__ feeds the change
    page's title/breadcrumb/heading verbatim."""

    def test_str_does_not_embed_the_user(self):
        user = User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )

        self.assertNotIn("signed-in", str(_make_report(user=user)))


class QuestionnaireResponseStrTests(TestCase):
    """__str__ feeds the admin change page's <title>/breadcrumb/heading verbatim, so it
    must never embed the raw user (#69) — same leak class as the FK-field fix above,
    just reached through Model.__str__ instead of a ModelAdmin field."""

    def test_str_does_not_embed_the_user(self):
        user = User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )
        response = QuestionnaireResponse.objects.create(
            user=user, session_id="s1", questionnaire_version=1, skipped=True
        )

        self.assertNotIn("signed-in", str(response))


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
        self.event = _make_event(user=self.subject)
        self.response = QuestionnaireResponse.objects.create(
            user=self.subject, session_id="s1", questionnaire_version=1, skipped=True
        )
        self.report = _make_report(user=self.subject)

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

    def test_behavior_event_change_view_shows_display_name_not_username(self):
        Profile.objects.create(user=self.subject, display_name="Ada Lovelace")

        resp = self.client.get(
            reverse("admin:analytics_behaviorevent_change", args=[self.event.pk])
        )

        html = resp.content.decode()
        self.assertIn("Ada Lovelace", html)
        # Bare substring, not just the readonly-field link: the username must not leak
        # anywhere on the page — title, breadcrumb, and heading all render it unescaped
        # via str(obj) if a model's __str__ embeds it (#69).
        self.assertNotIn("signed-in", html)

    def test_questionnaire_response_add_is_forbidden(self):
        resp = self.client.get(reverse("admin:analytics_questionnaireresponse_add"))
        self.assertEqual(resp.status_code, 403)

    def test_questionnaire_response_change_view_is_read_only_not_forbidden(self):
        resp = self.client.get(
            reverse("admin:analytics_questionnaireresponse_change", args=[self.response.pk])
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["has_change_permission"])

    def test_questionnaire_response_change_view_shows_display_name_not_username(self):
        Profile.objects.create(user=self.subject, display_name="Ada Lovelace")

        resp = self.client.get(
            reverse("admin:analytics_questionnaireresponse_change", args=[self.response.pk])
        )

        html = resp.content.decode()
        self.assertIn("Ada Lovelace", html)
        # Bare substring, not just the readonly-field link: the username must not leak
        # anywhere on the page — title, breadcrumb, and heading all render it unescaped
        # via str(obj) if a model's __str__ embeds it (#69).
        self.assertNotIn("signed-in", html)

    def test_error_report_add_is_forbidden(self):
        resp = self.client.get(reverse("admin:analytics_errorreport_add"))
        self.assertEqual(resp.status_code, 403)

    def test_error_report_changelist_renders(self):
        resp = self.client.get(reverse("admin:analytics_errorreport_changelist"))
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["has_add_permission"])

    def test_error_report_change_view_is_read_only_not_forbidden(self):
        resp = self.client.get(
            reverse("admin:analytics_errorreport_change", args=[self.report.pk])
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["has_change_permission"])

    def test_error_report_change_view_shows_display_name_not_username(self):
        Profile.objects.create(user=self.subject, display_name="Ada Lovelace")

        resp = self.client.get(
            reverse("admin:analytics_errorreport_change", args=[self.report.pk])
        )

        html = resp.content.decode()
        self.assertIn("Ada Lovelace", html)
        self.assertNotIn("signed-in", html)


class UserListFilterTests(TestCase):
    """The `user` filter sidebar must read like `user_display`, not User.__str__ (#69)."""

    def setUp(self):
        self.factory = RequestFactory()
        self.model_admin = BehaviorEventAdmin(BehaviorEvent, admin.site)
        self.named = User.objects.create_user(
            username="named", email="named@example.com", password="pw-12345678"
        )
        Profile.objects.create(user=self.named, display_name="Ada")
        _make_event(session_id="s1", user=self.named)
        _make_event(session_id="s2", user=None)

    def test_lookups_show_display_name_not_username(self):
        request = self.factory.get("/")
        f = UserListFilter(request, {}, BehaviorEvent, self.model_admin)

        lookups = dict(f.lookups(request, self.model_admin))

        self.assertEqual(lookups[str(self.named.pk)], "Ada")
        self.assertNotIn("named", lookups.values())

    def test_lookups_include_anonymous_bucket_when_null_rows_exist(self):
        request = self.factory.get("/")
        f = UserListFilter(request, {}, BehaviorEvent, self.model_admin)

        lookups = dict(f.lookups(request, self.model_admin))

        self.assertEqual(lookups["anonymous"], "Anonymous")

    def test_lookups_omit_anonymous_bucket_when_field_is_not_nullable(self):
        QuestionnaireResponse.objects.create(
            user=self.named, session_id="s1", questionnaire_version=1, skipped=True
        )
        qa_admin = QuestionnaireResponseAdmin(QuestionnaireResponse, admin.site)
        request = self.factory.get("/")
        f = UserListFilter(request, {}, QuestionnaireResponse, qa_admin)

        lookups = dict(f.lookups(request, qa_admin))

        self.assertNotIn("anonymous", lookups)

    def test_queryset_filters_by_selected_user(self):
        request = self.factory.get("/")
        f = UserListFilter(request, {"user": [str(self.named.pk)]}, BehaviorEvent, self.model_admin)

        qs = f.queryset(request, BehaviorEvent.objects.all())

        self.assertEqual(list(qs), [BehaviorEvent.objects.get(user=self.named)])

    def test_queryset_filters_the_anonymous_bucket(self):
        request = self.factory.get("/")
        f = UserListFilter(request, {"user": ["anonymous"]}, BehaviorEvent, self.model_admin)

        qs = f.queryset(request, BehaviorEvent.objects.all())

        self.assertEqual(list(qs), [BehaviorEvent.objects.get(user__isnull=True)])


def _make_feedback(**overrides):
    fields = {
        "session_id": "s1",
        "category": "bug",
        "body": "The Retry button re-runs the wrong search.",
        "app_version": "0.0.1",
    }
    fields.update(overrides)
    return Feedback.objects.create(**fields)


class FeedbackAdminTests(TestCase):
    """Visitor-written feedback is read in admin and never authored there (#137, ADR-0014)."""

    def setUp(self):
        self.site = admin.site
        self.user = User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )

    def test_columns_and_filters(self):
        self.assertEqual(
            FeedbackAdmin.list_display,
            ("created_at", "category", "user_display", "reply_requested", "session_id"),
        )
        self.assertEqual(FeedbackAdmin.list_filter, (UserListFilter, "category"))
        self.assertEqual(FeedbackAdmin.search_fields, ("session_id",))

    def test_shows_display_name_not_username(self):
        Profile.objects.create(user=self.user, display_name="Ada")
        feedback = _make_feedback(user=self.user)

        fa = FeedbackAdmin(Feedback, self.site)

        self.assertEqual(fa.user_display(feedback), "Ada")

    def test_shows_dash_for_anonymous_traffic(self):
        fa = FeedbackAdmin(Feedback, self.site)

        self.assertEqual(fa.user_display(_make_feedback(user=None)), "—")

    def test_reply_requested_flags_whether_a_contact_was_left(self):
        fa = FeedbackAdmin(Feedback, self.site)

        self.assertTrue(fa.reply_requested(_make_feedback(contact="ada@example.com")))
        self.assertFalse(fa.reply_requested(_make_feedback(contact="")))

    def test_str_embeds_neither_the_user_nor_the_prose(self):
        feedback = _make_feedback(user=self.user, body="my email is signed-in@example.com")

        rendered = str(feedback)

        self.assertNotIn("signed-in", rendered)
        self.assertNotIn("my email", rendered)


class FeedbackAdminReadOnlyTests(TestCase):
    def setUp(self):
        User.objects.create_superuser(
            username="admin", email="admin@example.com", password="pw-12345678"
        )
        self.client.login(username="admin", password="pw-12345678")
        self.feedback = _make_feedback()

    def test_add_is_forbidden(self):
        resp = self.client.get(reverse("admin:analytics_feedback_add"))
        self.assertEqual(resp.status_code, 403)

    def test_changelist_does_not_print_the_contact_a_visitor_left(self):
        # Same posture as #69's user column: the list page says whether a reply is
        # possible, and the address itself waits on the detail page.
        _make_feedback(contact="ada@example.com")

        resp = self.client.get(reverse("admin:analytics_feedback_changelist"))

        self.assertEqual(resp.status_code, 200)
        self.assertNotContains(resp, "ada@example.com")

    def test_change_view_is_read_only_not_forbidden(self):
        resp = self.client.get(
            reverse("admin:analytics_feedback_change", args=[self.feedback.pk])
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.context["has_change_permission"])
