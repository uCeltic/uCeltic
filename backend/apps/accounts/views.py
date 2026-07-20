import json

from allauth.account.internal.flows.email_verification import (
    send_verification_email_to_address,
)
from allauth.account.models import EmailAddress
from django.http import HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

from .models import Profile
from .serializers import ProfileSerializer


class ProfileView(RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # get_or_create, not a plain lookup: accounts registered before #66 predate the
        # signal that now creates this row on signup, so they'd otherwise 500 here.
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


@require_GET
@ensure_csrf_cookie
def csrf(request):
    """Hand the SPA a CSRF cookie to echo back as `X-CSRFToken`.

    Django only plants the `csrftoken` cookie on responses from views that ask for
    the token, and a single-page app renders no Django template that would. So the
    client calls this once before its first unsafe request (sign-in, sign-up); every
    allauth endpoint below is CSRF-protected. Anonymous /api/search/ and /api/events/
    need no token — DRF's SessionAuthentication only enforces CSRF once a session
    exists (ADR-0004: the tool stays usable without an account).
    """
    return HttpResponse(status=204)


@require_POST
def resend_verification_email(request):
    """Explicit "resend" for the mandatory activation link (#103).

    allauth's headless `email/verify/resend` only serves code-based
    verification; this project verifies by link, for which allauth has no
    standalone resend endpoint — only a side effect of a blocked login,
    which needs a password CheckEmailPage never has. This calls the same
    internal helper a blocked login does, so the button inherits its
    behavior for free: an unknown address gets allauth's enumeration-safe
    "no account" mail instead of a real one, and a repeat call inside the
    3-minute window is silently dropped rather than erroring — so, like
    every other case here, it still answers 200.
    """
    try:
        body = json.loads(request.body)
        email = body.get("email") if isinstance(body, dict) else None
    except json.JSONDecodeError:
        email = None
    if not email:
        return HttpResponseBadRequest()

    address = EmailAddress.objects.filter(email__iexact=email).first()
    if address is None:
        address = EmailAddress(user=None, email=email)
    if not address.verified:
        send_verification_email_to_address(request, address)

    return HttpResponse(status=200)
