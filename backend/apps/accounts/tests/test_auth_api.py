"""Registration → activation → login, over allauth's headless browser API (#64).

The SPA and the API share one origin, so the session cookie is the auth mechanism:
these tests drive the endpoints exactly as the browser will, cookies and all.
"""
import re
from urllib.parse import unquote

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase

SIGNUP = "/api/auth/browser/v1/auth/signup"
LOGIN = "/api/auth/browser/v1/auth/login"
VERIFY_EMAIL = "/api/auth/browser/v1/auth/email/verify"
SESSION = "/api/auth/browser/v1/auth/session"

EMAIL = "visitor@example.com"
PASSWORD = "correct-horse-battery-staple"

User = get_user_model()


def activation_key_from_last_email():
    """Pull the {key} out of the activation link allauth just emailed."""
    body = mail.outbox[-1].body
    match = re.search(r"/account/verify-email/([^\s/]+)", body)
    assert match, f"no activation link in email body:\n{body}"
    # The key is percent-encoded in the URL; the SPA hands the decoded value back.
    return unquote(match.group(1))


class RegistrationActivationLoginTests(TestCase):
    def setUp(self):
        # allauth rate-limits activation mail (`confirm_email`, 1 per 3 minutes per
        # address) through the cache, which outlives a test's database rollback — so a
        # stale counter from the previous test would silently swallow this test's email.
        cache.clear()

    def signup(self):
        return self.client.post(
            SIGNUP,
            data={"email": EMAIL, "password": PASSWORD},
            content_type="application/json",
        )

    def login(self):
        return self.client.post(
            LOGIN,
            data={"email": EMAIL, "password": PASSWORD},
            content_type="application/json",
        )

    def test_signup_creates_an_unverified_user_and_emails_an_activation_link(self):
        resp = self.signup()

        # 401: the account exists but the session is not authenticated until the
        # email is verified — allauth reports the pending stage rather than logging in.
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(EMAIL, mail.outbox[0].to)

        user = User.objects.get(email=EMAIL)
        self.assertFalse(
            EmailAddress.objects.get(user=user, email=EMAIL).verified,
        )

    def test_activation_link_carries_the_frontend_base_url(self):
        self.signup()

        # The link must point at the SPA (sslip.io in prod, #63), not at a Django view:
        # allauth runs headless-only, so there is no server-rendered confirm page.
        self.assertIn(
            "http://localhost:5173/account/verify-email/", mail.outbox[0].body
        )

    def test_login_before_activation_is_rejected(self):
        self.signup()
        self.client.logout()  # drop the pending-verification stage from signup

        resp = self.login()

        self.assertEqual(resp.status_code, 401)
        body = resp.json()
        self.assertFalse(body["meta"]["is_authenticated"])
        # The password was right, so allauth reports what is still owed: verify_email.
        self.assertIn(
            {"id": "verify_email", "is_pending": True},
            body["data"]["flows"],
        )

        # ...and the session really is anonymous, not merely reported as such.
        self.assertEqual(self.client.get(SESSION).status_code, 401)

    def test_a_failed_login_on_an_unverified_account_resends_the_activation_email(self):
        self.signup()
        self.client.logout()
        self.assertEqual(len(mail.outbox), 1)

        # Stand in for the 3 minutes a visitor waits before hitting "resend": within that
        # window allauth's rate limit deliberately drops the second mail.
        cache.clear()

        self.login()

        # allauth's default flow: the blocked login re-sends the activation link,
        # which is the re-send mechanism the SPA exposes as "resend activation".
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn(EMAIL, mail.outbox[1].to)

    def test_register_activate_login_happy_path(self):
        self.signup()
        key = activation_key_from_last_email()

        verify = self.client.post(
            VERIFY_EMAIL,
            data={"key": key},
            content_type="application/json",
        )
        # 401, not 200: confirming the link does not hand out a session, because the link
        # can be opened in a different browser than the one that signed up. The account is
        # activated and the visitor then signs in — which is exactly "activate, then login".
        self.assertEqual(verify.status_code, 401)

        user = User.objects.get(email=EMAIL)
        self.assertTrue(EmailAddress.objects.get(user=user, email=EMAIL).verified)

        resp = self.login()
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["meta"]["is_authenticated"])
        self.assertEqual(resp.json()["data"]["user"]["email"], EMAIL)

        session = self.client.get(SESSION)
        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.json()["data"]["user"]["email"], EMAIL)

    def test_logout_ends_the_session(self):
        self.signup()
        self.client.post(
            VERIFY_EMAIL,
            data={"key": activation_key_from_last_email()},
            content_type="application/json",
        )
        self.login()

        resp = self.client.delete(SESSION)

        self.assertEqual(resp.status_code, 401)
        self.assertEqual(self.client.get(SESSION).status_code, 401)

    def request_password_reset(self):
        return self.client.post(
            "/api/auth/browser/v1/auth/password/request",
            data={"email": EMAIL},
            content_type="application/json",
        )

    def test_password_reset_emails_a_link_to_the_spa(self):
        self.signup()
        mail.outbox.clear()

        resp = self.request_password_reset()

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(
            "http://localhost:5173/account/password/reset/key/", mail.outbox[0].body
        )

    def test_the_reset_key_sets_a_new_password_that_then_signs_in(self):
        self.signup()
        self.client.post(
            VERIFY_EMAIL,
            data={"key": activation_key_from_last_email()},
            content_type="application/json",
        )
        mail.outbox.clear()
        self.request_password_reset()

        key = unquote(
            re.search(
                r"/account/password/reset/key/([^\s/]+)", mail.outbox[0].body
            ).group(1)
        )
        new_password = "a-different-passphrase-entirely"
        reset = self.client.post(
            "/api/auth/browser/v1/auth/password/reset",
            data={"key": key, "password": new_password},
            content_type="application/json",
        )
        # 401 again, and for the same reason as the activation link: the password is
        # changed, but a mailed key does not by itself hand out a session.
        self.assertEqual(reset.status_code, 401)

        signed_in = self.client.post(
            LOGIN,
            data={"email": EMAIL, "password": new_password},
            content_type="application/json",
        )
        self.assertEqual(signed_in.status_code, 200)
        self.assertTrue(signed_in.json()["meta"]["is_authenticated"])

        # ...and the password it replaced no longer works.
        self.client.logout()
        self.assertEqual(self.login().status_code, 400)
