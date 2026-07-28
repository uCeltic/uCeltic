"""Backend Error Report capture (#135, ADR-0013).

Three invariants the slice exists for: 5xx only, secrets/email scrubbed before storing,
and `user` stamped from the server's idea of who is signed in — never from the body.
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from apps.analytics.error_capture import scrub
from apps.analytics.models import ErrorReport

User = get_user_model()


@override_settings(ROOT_URLCONF="apps.analytics.tests.urls_boom")
class BackendErrorCaptureTests(APITestCase):
    def setUp(self):
        # Without this the test client re-raises the view's exception instead of letting
        # Django build the 500 response — and the capture path is *in* that response cycle.
        self.client.raise_request_exception = False

    def test_unhandled_500_writes_one_reproducible_report(self):
        resp = self.client.post(
            "/boom/", {"query": "brigit", "params": {"mode": "exact"}}, format="json"
        )

        self.assertEqual(resp.status_code, 500)
        report = ErrorReport.objects.get()
        self.assertEqual(report.kind, "backend_5xx")
        self.assertEqual(report.status_code, 500)
        self.assertEqual(report.request_path, "/boom/")
        self.assertEqual(report.method, "POST")
        self.assertIn("RuntimeError", report.traceback)
        self.assertIn("boom", report.traceback)
        self.assertEqual(report.context["query"], "brigit")
        self.assertEqual(report.context["params"], {"mode": "exact"})
        self.assertTrue(report.fingerprint)
        self.assertIsNotNone(report.server_ts)

    def test_password_is_dropped_from_the_stored_context(self):
        self.client.post(
            "/boom/",
            {"query": "x", "password": "hunter2", "account": {"password": "hunter2"}},
            format="json",
        )

        report = ErrorReport.objects.get()
        self.assertNotIn("password", report.context)
        self.assertNotIn("password", report.context["account"])
        self.assertNotIn("hunter2", str(report.context))
        self.assertEqual(report.context["query"], "x")

    def test_email_is_never_stored(self):
        self.client.post("/boom/", {"email": "leak@example.com", "query": "x"}, format="json")

        self.assertNotIn("leak@example.com", str(ErrorReport.objects.get().context))

    def test_an_email_inside_the_exception_message_is_redacted_too(self):
        # The body isn't the only way an address reaches the row: an SMTP refusal or a
        # duplicate-key IntegrityError puts the visitor's address in the message itself,
        # which lands in both `summary` and `traceback` (ADR-0013: store no email).
        self.client.get("/leaky-boom/")

        report = ErrorReport.objects.get()
        self.assertNotIn("leak@example.com", report.summary)
        self.assertNotIn("leak@example.com", report.traceback)
        self.assertIn("SMTP refused recipient", report.summary)

    def test_a_5xx_drf_turns_into_a_response_is_still_recorded(self):
        resp = self.client.post("/upstream-failed/", {"query": "x"}, format="json")

        self.assertEqual(resp.status_code, 503)
        report = ErrorReport.objects.get()
        self.assertEqual(report.status_code, 503)
        self.assertIn("UpstreamUnavailable", report.traceback)

    def test_4xx_writes_nothing(self):
        resp = self.client.post("/bad-request/", {"query": "x"}, format="json")

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(ErrorReport.objects.count(), 0)

    def test_user_is_stamped_server_side_not_taken_from_the_body(self):
        signed_in = User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )
        impostor = User.objects.create_user(
            username="impostor", email="impostor@example.com", password="pw-12345678"
        )
        self.client.force_login(signed_in)

        self.client.post("/boom/", {"query": "x", "user": impostor.pk}, format="json")

        self.assertEqual(ErrorReport.objects.get().user, signed_in)

    def test_anonymous_traffic_is_recorded_without_a_user(self):
        self.client.post("/boom/", {"query": "x"}, format="json")

        self.assertIsNone(ErrorReport.objects.get().user)

    def test_session_id_is_recorded_when_the_request_carries_one(self):
        self.client.post("/boom/", {"session_id": "s-42", "query": "x"}, format="json")

        self.assertEqual(ErrorReport.objects.get().session_id, "s-42")

    def test_session_id_is_blank_when_the_request_does_not_carry_one(self):
        # The ADR-0013 consequence: search/auth requests don't send it today, so the
        # report is self-contained for reproduction but joins to a timeline only by user/time.
        self.client.post("/boom/", {"query": "x"}, format="json")

        self.assertEqual(ErrorReport.objects.get().session_id, "")

    def test_query_string_is_kept_for_reproduction(self):
        self.client.post("/boom/?page=3", {"query": "x"}, format="json")

        self.assertEqual(ErrorReport.objects.get().request_path, "/boom/?page=3")

    def test_secrets_in_the_query_string_are_scrubbed_too(self):
        self.client.post("/boom/?token=hunter2", {"query": "x"}, format="json")

        self.assertNotIn("hunter2", ErrorReport.objects.get().request_path)

    def test_a_drf_500_is_recorded_once_not_twice(self):
        # The exception escapes DRF's handler and reaches Django's handler500 as well;
        # only one row may come out of one request.
        self.client.post("/boom/", {"query": "x"}, format="json")

        self.assertEqual(ErrorReport.objects.count(), 1)

    def test_a_non_drf_page_500_is_recorded_by_handler500(self):
        resp = self.client.get("/plain-boom/")

        self.assertEqual(resp.status_code, 500)
        report = ErrorReport.objects.get()
        self.assertEqual(report.request_path, "/plain-boom/")
        self.assertEqual(report.method, "GET")
        self.assertIn("plain boom", report.traceback)

    def test_a_non_drf_form_post_still_captures_a_scrubbed_body(self):
        # handler500's request is a plain HttpRequest — no `.data` — so the form fields
        # have to come from POST, or the allauth pages the hook exists for record nothing.
        self.client.post("/plain-boom/", {"login": "ada", "password": "hunter2"})

        report = ErrorReport.objects.get()
        self.assertEqual(report.context["login"], "ada")
        self.assertNotIn("password", report.context)

    def test_capture_failure_never_masks_the_original_error(self):
        # An ErrorReport that raises while being written must not turn a 500 into a
        # different 500 (or an unhandled crash in the error path).
        with patch.object(ErrorReport.objects, "create", side_effect=RuntimeError("db down")):
            with self.assertLogs("apps.analytics.error_capture", level="ERROR") as logs:
                resp = self.client.post("/boom/", {"query": "x"}, format="json")

        self.assertEqual(resp.status_code, 500)
        # One attempt per request: a failed write is not retried by handler500 upstream.
        self.assertEqual(len(logs.records), 1)
        self.assertEqual(ErrorReport.objects.count(), 0)


class ScrubTests(TestCase):
    """The scrub is the one piece worth testing away from a request cycle."""

    def test_drops_secret_named_keys_case_insensitively(self):
        self.assertEqual(scrub({"Password": "x", "query": "keep"}), {"query": "keep"})

    def test_drops_secrets_nested_in_dicts_and_lists(self):
        cleaned = scrub({"items": [{"token": "x", "id": 1}], "inner": {"api_key": "x"}})

        self.assertEqual(cleaned, {"items": [{"id": 1}], "inner": {}})

    def test_keeps_non_secret_values_untouched(self):
        payload = {"query": "brigit", "params": {"mode": "fuzzy", "threshold": 0.8}}

        self.assertEqual(scrub(payload), payload)

    def test_returns_an_empty_dict_for_a_body_that_is_not_a_mapping(self):
        self.assertEqual(scrub("not-a-dict"), {})
        self.assertEqual(scrub(None), {})
