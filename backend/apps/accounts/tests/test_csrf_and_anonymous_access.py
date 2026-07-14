"""CSRF plumbing, and the guarantee that accounts change nothing for visitors (#64).

DRF gets `SessionAuthentication` back in #64, which enforces CSRF — but only for
requests that actually carry a session. The public tool (ADR-0004) must keep working
for anonymous visitors with no token at all, so both halves are pinned here.
"""
from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from apps.analytics.models import BehaviorEvent

User = get_user_model()

EVENT = {
    "session_id": "11111111-1111-1111-1111-111111111111",
    "event_type": "session_started",
    "payload": {},
    "client_ts": "2026-07-13T10:00:00Z",
    "app_version": "0.0.1",
}


class CsrfEndpointTests(TestCase):
    def test_csrf_endpoint_sets_a_readable_token_cookie(self):
        resp = self.client.get("/api/auth/csrf/")

        self.assertEqual(resp.status_code, 204)
        cookie = resp.cookies["csrftoken"]
        self.assertTrue(cookie.value)
        # The SPA reads the cookie from JS to echo it back as X-CSRFToken.
        self.assertFalse(cookie["httponly"])


class AnonymousAccessUnaffectedTests(TestCase):
    """Regression guard for the SPA's anonymous POSTs (/api/search/, /api/events/)."""

    def setUp(self):
        # enforce_csrf_checks: the plain test client silently exempts CSRF, which would
        # make these tests pass even if the middleware rejected the request in a browser.
        self.client = Client(enforce_csrf_checks=True)

    def test_anonymous_event_post_without_a_csrf_token_still_works(self):
        resp = self.client.post(
            "/api/events/", data=EVENT, content_type="application/json"
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(BehaviorEvent.objects.count(), 1)

    def test_anonymous_search_post_without_a_csrf_token_is_not_csrf_rejected(self):
        resp = self.client.post(
            "/api/search/",
            data={"doc_id": 999999, "query": "cetera"},
            content_type="application/json",
        )

        # 404 (no such document) is fine — the point is that CSRF did not reject it.
        self.assertNotEqual(resp.status_code, 403)


class AuthenticatedRequestsNeedCsrfTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        User.objects.create_user(
            username="signed-in", email="signed-in@example.com", password="pw-12345678"
        )
        self.client.login(username="signed-in", password="pw-12345678")

    def test_session_authenticated_post_without_a_token_is_rejected(self):
        resp = self.client.post(
            "/api/events/", data=EVENT, content_type="application/json"
        )

        self.assertEqual(resp.status_code, 403)
        self.assertEqual(BehaviorEvent.objects.count(), 0)

    def test_session_authenticated_post_with_the_token_succeeds(self):
        token = self.client.get("/api/auth/csrf/").cookies["csrftoken"].value

        resp = self.client.post(
            "/api/events/",
            data=EVENT,
            content_type="application/json",
            headers={"x-csrftoken": token},
        )

        self.assertEqual(resp.status_code, 201)
