"""URLconf used only by the error-capture tests: endpoints that fail on purpose.

Kept out of the real urlconf — the capture path has to be exercised through a real
request/response cycle (DRF's exception handler and Django's handler500 only run there),
and the app itself has no endpoint that reliably 500s.
"""
from django.urls import path
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import APIView


class BoomView(APIView):
    """An unhandled exception inside a DRF view — the case ADR-0013 calls the
    reproducible core: the client only ever sees `500`, the traceback lives here."""

    def post(self, request):
        raise RuntimeError("boom")


class BadRequestView(APIView):
    """A 4xx: the API working as designed, and deliberately *not* an Error Report."""

    def post(self, request):
        return Response({"error": "bad"}, status=400)


class UpstreamUnavailable(APIException):
    status_code = 503
    default_detail = "upstream unavailable"


class UpstreamFailedView(APIView):
    """A 5xx DRF *handles*: it turns the exception into a 503 response rather than
    re-raising it, so the report has to be written off the response, not off a crash."""

    def post(self, request):
        raise UpstreamUnavailable()


def plain_boom(request):
    """A non-DRF page (the allauth/admin case) — reaches Django's handler500 instead."""
    raise RuntimeError("plain boom")


def leaky_boom(request):
    """The real allauth shape: an exception whose *message* carries the address the
    visitor typed (an SMTP refusal, a duplicate-key IntegrityError)."""
    raise RuntimeError("SMTP refused recipient leak@example.com (550)")


urlpatterns = [
    path("boom/", BoomView.as_view()),
    path("bad-request/", BadRequestView.as_view()),
    path("upstream-failed/", UpstreamFailedView.as_view()),
    path("plain-boom/", plain_boom),
    path("leaky-boom/", leaky_boom),
]

handler500 = "apps.analytics.error_capture.handler500"
