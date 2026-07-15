from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.analytics.models import BehaviorEvent

User = get_user_model()


class BehaviorEventEndpointTests(APITestCase):
    def _payload(self, **overrides):
        payload = {
            "session_id": "11111111-1111-1111-1111-111111111111",
            "event_type": "session_started",
            "payload": {"screen": "workspace"},
            "client_ts": "2026-07-07T10:00:00Z",
            "app_version": "0.0.1",
        }
        payload.update(overrides)
        return payload

    def test_valid_event_returns_201_and_persists_one_row(self):
        resp = self.client.post("/api/events/", self._payload(), format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(BehaviorEvent.objects.count(), 1)

        row = BehaviorEvent.objects.get()
        self.assertEqual(row.session_id, "11111111-1111-1111-1111-111111111111")
        self.assertEqual(row.event_type, "session_started")
        self.assertEqual(row.payload, {"screen": "workspace"})
        self.assertEqual(row.app_version, "0.0.1")
        self.assertIsNotNone(row.server_ts)

    def test_unknown_event_type_returns_400(self):
        resp = self.client.post(
            "/api/events/", self._payload(event_type="page_view"), format="json"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("error", resp.data)
        self.assertEqual(BehaviorEvent.objects.count(), 0)

    def test_missing_session_id_returns_4xx_not_500(self):
        payload = self._payload()
        del payload["session_id"]
        resp = self.client.post("/api/events/", payload, format="json")
        self.assertGreaterEqual(resp.status_code, 400)
        self.assertLess(resp.status_code, 500)

    def test_malformed_client_ts_returns_4xx_not_500(self):
        resp = self.client.post(
            "/api/events/", self._payload(client_ts="not-a-date"), format="json"
        )
        self.assertGreaterEqual(resp.status_code, 400)
        self.assertLess(resp.status_code, 500)

    def test_payload_round_trips_as_sent(self):
        nested = {"rating": 4, "text": "confusing", "context": {"panel": "search"}}
        resp = self.client.post(
            "/api/events/",
            self._payload(event_type="feedback_submitted", payload=nested),
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(BehaviorEvent.objects.get().payload, nested)


class BehaviorEventAttributionTests(APITestCase):
    """#68: attribution rides on server-side session, not on anything the client sends."""

    def _payload(self, **overrides):
        payload = {
            "session_id": "11111111-1111-1111-1111-111111111111",
            "event_type": "session_started",
            "payload": {"screen": "workspace"},
            "client_ts": "2026-07-07T10:00:00Z",
            "app_version": "0.0.1",
        }
        payload.update(overrides)
        return payload

    def setUp(self):
        self.user = User.objects.create_user(
            username="signed-in", email="visitor@example.com", password="correct-horse-battery-staple"
        )

    def test_authenticated_event_carries_user(self):
        self.client.login(username="signed-in", password="correct-horse-battery-staple")

        resp = self.client.post("/api/events/", self._payload(), format="json")

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(BehaviorEvent.objects.get().user, self.user)

    def test_anonymous_event_has_null_user(self):
        resp = self.client.post("/api/events/", self._payload(), format="json")

        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(BehaviorEvent.objects.get().user)

    def test_client_supplied_user_field_is_ignored(self):
        other = User.objects.create_user(
            username="other", email="other@example.com", password="correct-horse-battery-staple"
        )

        # Not signed in as anyone: a stray "user" in the body must not attribute the
        # event to a different account, or to anyone at all.
        resp = self.client.post("/api/events/", self._payload(user=other.pk), format="json")

        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(BehaviorEvent.objects.get().user)