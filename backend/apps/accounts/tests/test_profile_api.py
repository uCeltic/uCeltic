"""Minimal profile: display name round-trip, auth-gated (#66)."""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase

from apps.accounts.models import Profile

PROFILE = "/api/auth/profile/"
SIGNUP = "/api/auth/browser/v1/auth/signup"

EMAIL = "visitor@example.com"
PASSWORD = "correct-horse-battery-staple"

User = get_user_model()


class ProfileAutoCreateTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_signing_up_auto_creates_a_profile_with_an_empty_display_name(self):
        self.client.post(
            SIGNUP,
            data={"email": EMAIL, "password": PASSWORD},
            content_type="application/json",
        )

        user = User.objects.get(email=EMAIL)
        self.assertEqual(user.profile.display_name, "")


class ProfileApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="signed-in", email=EMAIL, password=PASSWORD
        )
        # Auto-create only fires on the real allauth signup flow, so a directly
        # `create_user`-ed test fixture needs the same profile a real user gets.
        Profile.objects.get_or_create(user=self.user)

    def login(self):
        self.client.login(username="signed-in", password=PASSWORD)

    def test_anonymous_get_is_rejected(self):
        resp = self.client.get(PROFILE)

        self.assertIn(resp.status_code, (401, 403))

    def test_anonymous_patch_is_rejected(self):
        resp = self.client.patch(
            PROFILE,
            data={"display_name": "Nosy"},
            content_type="application/json",
        )

        self.assertIn(resp.status_code, (401, 403))

    def test_get_returns_email_and_display_name(self):
        self.login()

        resp = self.client.get(PROFILE)

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["email"], EMAIL)
        self.assertEqual(body["display_name"], "")

    def test_patch_updates_the_display_name(self):
        self.login()

        resp = self.client.patch(
            PROFILE,
            data={"display_name": "Ada"},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["display_name"], "Ada")
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.display_name, "Ada")

    def test_get_lazily_creates_a_profile_for_a_user_who_predates_the_signal(self):
        # Simulates a #64/#65 account: created before this signal existed, so it has no
        # Profile row at all — not merely one with an empty display_name.
        pre_existing = User.objects.create_user(
            username="already-here", email="already-here@example.com", password=PASSWORD
        )
        self.assertFalse(Profile.objects.filter(user=pre_existing).exists())
        self.client.login(username="already-here", password=PASSWORD)

        resp = self.client.get(PROFILE)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["display_name"], "")
        self.assertTrue(Profile.objects.filter(user=pre_existing).exists())

    def test_patch_cannot_change_the_email(self):
        self.login()

        resp = self.client.patch(
            PROFILE,
            data={"email": "someone-else@example.com", "display_name": "Ada"},
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, EMAIL)
