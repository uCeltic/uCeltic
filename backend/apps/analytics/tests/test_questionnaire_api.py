"""Pre-use purpose questionnaire: submit + skip round-trips, open to guests (#67, ADR-0007)."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.analytics.models import QUESTIONNAIRE_VERSION, QuestionnaireResponse

QUESTIONNAIRE = "/api/questionnaire/"

EMAIL = "visitor@example.com"
PASSWORD = "correct-horse-battery-staple"
SESSION_ID = "11111111-1111-1111-1111-111111111111"

User = get_user_model()


class QuestionnaireDefinitionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="signed-in", email=EMAIL, password=PASSWORD
        )

    def test_anonymous_get_returns_version_and_questions(self):
        resp = self.client.get(QUESTIONNAIRE)

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["version"], QUESTIONNAIRE_VERSION)
        self.assertTrue(len(body["questions"]) >= 1)

    def test_signed_in_get_returns_version_and_questions(self):
        self.client.login(username="signed-in", password=PASSWORD)

        resp = self.client.get(QUESTIONNAIRE)

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["version"], QUESTIONNAIRE_VERSION)
        self.assertTrue(len(body["questions"]) >= 1)
        self.assertIn("id", body["questions"][0])
        self.assertIn("prompt", body["questions"][0])


class QuestionnaireSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="signed-in", email=EMAIL, password=PASSWORD
        )

    def login(self):
        self.client.login(username="signed-in", password=PASSWORD)

    def test_anonymous_post_persists_a_row_with_null_user(self):
        resp = self.client.post(
            QUESTIONNAIRE,
            data={"session_id": SESSION_ID, "skipped": False, "answers": {"purpose": "reading"}},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        row = QuestionnaireResponse.objects.get()
        self.assertIsNone(row.user)
        self.assertEqual(row.session_id, SESSION_ID)

    def test_submitting_answers_persists_a_row_stamped_with_the_user(self):
        self.login()

        resp = self.client.post(
            QUESTIONNAIRE,
            data={
                "session_id": SESSION_ID,
                "skipped": False,
                "answers": {"purpose": "checking a specific passage"},
            },
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        row = QuestionnaireResponse.objects.get()
        self.assertEqual(row.user, self.user)
        self.assertEqual(row.session_id, SESSION_ID)
        self.assertEqual(row.questionnaire_version, QUESTIONNAIRE_VERSION)
        self.assertEqual(row.answers, {"purpose": "checking a specific passage"})
        self.assertFalse(row.skipped)
        self.assertIsNotNone(row.created_at)

    def test_skipping_persists_a_row_with_null_answers(self):
        self.login()

        resp = self.client.post(
            QUESTIONNAIRE,
            data={"session_id": SESSION_ID, "skipped": True},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        row = QuestionnaireResponse.objects.get()
        self.assertTrue(row.skipped)
        self.assertIsNone(row.answers)

    def test_skip_ignores_any_answers_sent_alongside_it(self):
        self.login()

        resp = self.client.post(
            QUESTIONNAIRE,
            data={"session_id": SESSION_ID, "skipped": True, "answers": {"purpose": "x"}},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(QuestionnaireResponse.objects.get().answers)

    def test_missing_answers_when_not_skipped_returns_400(self):
        self.login()

        resp = self.client.post(
            QUESTIONNAIRE,
            data={"session_id": SESSION_ID, "skipped": False},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(QuestionnaireResponse.objects.count(), 0)

    def test_missing_session_id_returns_4xx_not_500(self):
        self.login()

        resp = self.client.post(
            QUESTIONNAIRE,
            data={"skipped": True},
            content_type="application/json",
        )

        self.assertGreaterEqual(resp.status_code, 400)
        self.assertLess(resp.status_code, 500)

    def test_response_is_stamped_with_the_requesting_user_not_a_client_supplied_one(self):
        other = User.objects.create_user(
            username="someone-else", email="someone-else@example.com", password=PASSWORD
        )
        self.login()

        resp = self.client.post(
            QUESTIONNAIRE,
            data={"session_id": SESSION_ID, "skipped": True, "user": other.pk},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        row = QuestionnaireResponse.objects.get()
        self.assertEqual(row.user, self.user)
        self.assertNotEqual(row.user, other)

    def test_anonymous_post_ignores_any_client_supplied_user_field(self):
        other = User.objects.create_user(
            username="someone-else", email="someone-else@example.com", password=PASSWORD
        )

        resp = self.client.post(
            QUESTIONNAIRE,
            data={"session_id": SESSION_ID, "skipped": True, "user": other.pk},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(QuestionnaireResponse.objects.get().user)
