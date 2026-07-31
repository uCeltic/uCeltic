"""Visitor-written feedback: open to guests, attributed server-side (#137, ADR-0014)."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.analytics.models import FEEDBACK_BODY_MAX_LENGTH, Feedback

FEEDBACK = "/api/feedback/"

EMAIL = "visitor@example.com"
PASSWORD = "correct-horse-battery-staple"
SESSION_ID = "11111111-1111-1111-1111-111111111111"

User = get_user_model()


def _payload(**overrides):
    payload = {
        "session_id": SESSION_ID,
        "category": "bug",
        "body": "The Retry button re-runs the wrong search.",
        "app_version": "0.0.1",
    }
    payload.update(overrides)
    return payload


class FeedbackSubmissionTests(TestCase):
    def test_anonymous_submission_returns_201_and_persists_one_row(self):
        resp = self.client.post(FEEDBACK, _payload(), content_type="application/json")

        self.assertEqual(resp.status_code, 201)
        row = Feedback.objects.get()
        self.assertEqual(row.session_id, SESSION_ID)
        self.assertEqual(row.category, "bug")
        self.assertEqual(row.body, "The Retry button re-runs the wrong search.")
        self.assertEqual(row.app_version, "0.0.1")
        self.assertIsNone(row.user)
        self.assertIsNotNone(row.created_at)

    def test_optional_contact_and_context_round_trip(self):
        context = {
            "open_document_ids": [3, 7],
            "selected_work_id": 2,
            "viewport": {"width": 1440, "height": 900},
            "url": "http://localhost:5173/workspace",
        }
        resp = self.client.post(
            FEEDBACK,
            _payload(contact="reply@example.com", context=context),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        row = Feedback.objects.get()
        self.assertEqual(row.contact, "reply@example.com")
        self.assertEqual(row.context, context)

    def test_omitted_contact_and_context_default_to_empty(self):
        resp = self.client.post(FEEDBACK, _payload(), content_type="application/json")

        self.assertEqual(resp.status_code, 201)
        row = Feedback.objects.get()
        self.assertEqual(row.contact, "")
        self.assertEqual(row.context, {})

    def test_category_defaults_to_other_when_omitted(self):
        payload = _payload()
        del payload["category"]

        resp = self.client.post(FEEDBACK, payload, content_type="application/json")

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Feedback.objects.get().category, "other")


class FeedbackAttributionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="signed-in", email=EMAIL, password=PASSWORD
        )

    def test_signed_in_submission_is_attributed_to_the_request_user(self):
        self.client.login(username="signed-in", password=PASSWORD)

        resp = self.client.post(FEEDBACK, _payload(), content_type="application/json")

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Feedback.objects.get().user, self.user)

    def test_user_in_the_request_body_is_never_trusted(self):
        impersonated = User.objects.create_user(
            username="someone-else", email="other@example.com", password=PASSWORD
        )

        resp = self.client.post(
            FEEDBACK, _payload(user=impersonated.pk), content_type="application/json"
        )

        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(Feedback.objects.get().user)


class FeedbackValidationTests(TestCase):
    def _assert_rejected(self, payload):
        resp = self.client.post(FEEDBACK, payload, content_type="application/json")

        self.assertEqual(resp.status_code, 400)
        self.assertIn("error", resp.json())
        self.assertEqual(Feedback.objects.count(), 0)

    def test_category_outside_the_closed_set_is_rejected(self):
        self._assert_rejected(_payload(category="praise"))

    def test_empty_body_is_rejected(self):
        self._assert_rejected(_payload(body=""))

    def test_whitespace_only_body_is_rejected(self):
        self._assert_rejected(_payload(body="   \n  "))

    def test_over_length_body_is_rejected(self):
        self._assert_rejected(_payload(body="x" * (FEEDBACK_BODY_MAX_LENGTH + 1)))

    def test_missing_session_id_is_rejected(self):
        payload = _payload()
        del payload["session_id"]
        self._assert_rejected(payload)
