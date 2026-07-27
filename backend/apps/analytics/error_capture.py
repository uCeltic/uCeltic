"""Recording unhandled server-side failures as Error Reports (#135, ADR-0013).

Two entry points, one per way a 5xx can be produced:

- `exception_handler` — DRF's `EXCEPTION_HANDLER`, covering every API view.
- `handler500` — Django's, covering the non-DRF pages (allauth, admin).

Both funnel into `record`, which is best-effort by design: a failure while recording a
failure must never replace the original error with a different one.
"""
import logging
import sys
import traceback as traceback_module
from urllib.parse import parse_qsl, urlencode

from django.views.defaults import server_error
from rest_framework.views import exception_handler as drf_exception_handler

from .models import ErrorReport

logger = logging.getLogger(__name__)

BACKEND_5XX = "backend_5xx"

# Dropped, not masked: the issue asks for the secret to be *gone* from the stored body.
# `email` is here for a different reason — it isn't a secret, it's the PII ADR-0013 says
# we never store, because identity rides on the `user` FK alone (#69).
_SECRET_KEY_MARKERS = (
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "credential",
    "email",
)

# Set on the underlying HttpRequest once a report is written, so a DRF exception that
# escapes to Django's handler500 isn't recorded twice for the one request.
_RECORDED_FLAG = "_error_report_recorded"


def _is_secret(key):
    lowered = str(key).lower()
    return any(marker in lowered for marker in _SECRET_KEY_MARKERS)


def _scrub_value(value):
    if isinstance(value, dict):
        return {k: _scrub_value(v) for k, v in value.items() if not _is_secret(k)}
    if isinstance(value, (list, tuple)):
        return [_scrub_value(item) for item in value]
    return value


def scrub(body):
    """A request body reduced to what is safe to keep: no secrets, no email.

    Returns `{}` for anything that isn't a mapping — a list or raw-string body carries no
    reproduction value we can safely interpret, and `context` is a dict-shaped field.
    """
    if not isinstance(body, dict):
        return {}
    return _scrub_value(body)


def _scrub_query_string(request):
    """The full path, with any secret-named query parameter dropped.

    Reproducing a GET failure needs its query string, and `request.path` throws it away —
    but a query string can carry a token, so it goes through the same key filter.
    """
    query = request.META.get("QUERY_STRING", "")
    if not query:
        return request.path
    kept = [(k, v) for k, v in parse_qsl(query, keep_blank_values=True) if not _is_secret(k)]
    return f"{request.path}?{urlencode(kept)}" if kept else request.path


def _body(request):
    """The parsed request body, best-effort — an unparseable one is not worth a second error."""
    try:
        return request.data
    except Exception:
        return None


def _user(request):
    """Who the *server* thinks is signed in. Never read from the body (#68)."""
    try:
        user = request.user
    except Exception:
        return None
    return user if getattr(user, "is_authenticated", False) else None


def _summary(exc, status_code):
    if exc is None:
        return f"HTTP {status_code}"
    return f"{type(exc).__name__}: {exc}"[:255]


def _fingerprint(exc, path):
    """`kind:what threw:where` — enough for the admin to group like failures."""
    marker = type(exc).__name__ if exc is not None else "unknown"
    return f"{BACKEND_5XX}:{marker}:{path}"[:255]


def _traceback(exc):
    if exc is None:
        return None
    return "".join(traceback_module.format_exception(type(exc), exc, exc.__traceback__))


def record(request, exc, status_code):
    """Write one ErrorReport for this request. Swallows its own failures."""
    http_request = getattr(request, "_request", request)
    if getattr(http_request, _RECORDED_FLAG, False):
        return
    # Claimed before the write, not after: one attempt per request either way, so a
    # failed write doesn't get retried by handler500 further up the stack.
    setattr(http_request, _RECORDED_FLAG, True)
    try:
        body = scrub(_body(request))
        # Left in `context` as well: it's a faithful (scrubbed) copy of what was sent.
        session_id = body.get("session_id", "")
        path = _scrub_query_string(http_request)
        ErrorReport.objects.create(
            session_id=session_id if isinstance(session_id, str) else "",
            kind=BACKEND_5XX,
            summary=_summary(exc, status_code),
            status_code=status_code,
            request_path=path[:500],
            method=http_request.method or "",
            context=body,
            traceback=_traceback(exc),
            fingerprint=_fingerprint(exc, http_request.path),
            user=_user(request),
        )
    except Exception:
        logger.exception("Failed to record an ErrorReport")


def exception_handler(exc, context):
    """DRF's exception handler, with 5xx recorded on the way past.

    A 4xx is the API working as designed (validation, auth, rate-limit) and is not an
    error — ADR-0013. An exception DRF doesn't recognise yields `response is None`; DRF
    re-raises it and Django turns it into a 500, so that is the other 5xx case.
    """
    response = drf_exception_handler(exc, context)
    request = context.get("request")
    if request is None:
        return response
    if response is None:
        record(request, exc, 500)
    elif response.status_code >= 500:
        record(request, exc, response.status_code)
    return response


def handler500(request):
    """Django's `handler500`, for the pages DRF never sees (allauth, admin).

    Runs inside Django's `except` block, so the exception is still on `sys.exc_info()`.
    """
    record(request, sys.exc_info()[1], 500)
    return server_error(request)
