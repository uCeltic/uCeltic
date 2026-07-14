from django.http import HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

from .serializers import ProfileSerializer


class ProfileView(RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


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
