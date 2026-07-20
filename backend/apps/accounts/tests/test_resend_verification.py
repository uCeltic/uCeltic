"""Explicit "resend verification email" button (#103).

allauth's own headless resend endpoint (`email/verify/resend`) only serves
code-based verification (`EMAIL_VERIFICATION_BY_CODE_ENABLED`); this project
uses link-based mandatory verification, so that endpoint 409s unconditionally
here. The only resend path allauth ships for link-based verification is a
side effect of a blocked login — which needs a password the visitor typed
once and CheckEmailPage never sees again. This app-level endpoint reuses
allauth's own `send_verification_email_to_address` (the same function a
blocked login calls) so the button gets identical behavior: enumeration-safe,
and silently rate-limited rather than erroring.
"""
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase

RESEND = "/api/auth/resend-verification-email/"
SIGNUP = "/api/auth/browser/v1/auth/signup"

EMAIL = "visitor@example.com"
PASSWORD = "correct-horse-battery-staple"

User = get_user_model()


class ResendVerificationEmailTests(TestCase):
    def setUp(self):
        # Same reasoning as RegistrationActivationLoginTests: the rate-limit cache
        # outlives a test's DB rollback and would otherwise bleed between tests.
        cache.clear()

    def signup(self):
        return self.client.post(
            SIGNUP,
            data={"email": EMAIL, "password": PASSWORD},
            content_type="application/json",
        )

    def resend(self, email=EMAIL):
        return self.client.post(
            RESEND, data={"email": email}, content_type="application/json"
        )

    def test_resends_to_an_unverified_account(self):
        self.signup()
        self.assertEqual(len(mail.outbox), 1)
        # Signup's own send already consumed this window; stand in for the 3
        # minutes a visitor waits before the button re-enables.
        cache.clear()

        resp = self.resend()

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        self.assertIn(EMAIL, mail.outbox[1].to)

    def test_unknown_email_still_answers_200_without_revealing_that(self):
        resp = self.resend("nobody@example.com")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b"")

    def test_already_verified_email_sends_nothing_but_still_answers_200(self):
        self.signup()
        address = EmailAddress.objects.get(email=EMAIL)
        address.verified = True
        address.save()
        self.assertEqual(len(mail.outbox), 1)

        resp = self.resend()

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_a_second_call_inside_the_rate_limit_window_sends_nothing_but_still_answers_200(self):
        self.signup()
        cache.clear()
        self.assertEqual(len(mail.outbox), 1)

        first = self.resend()
        second = self.resend()

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        # allauth's `confirm_email` limit is 1 per 3 minutes per address (ADR-0009);
        # the first resend consumes it, so the second is silently dropped.
        self.assertEqual(len(mail.outbox), 2)

    def test_missing_email_is_a_400(self):
        resp = self.client.post(RESEND, data={}, content_type="application/json")

        self.assertEqual(resp.status_code, 400)

    def test_a_non_object_json_body_is_a_400_not_a_500(self):
        resp = self.client.post(
            RESEND, data="[]", content_type="application/json"
        )

        self.assertEqual(resp.status_code, 400)
