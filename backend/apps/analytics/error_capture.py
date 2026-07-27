"""Recording unhandled server-side failures as Error Reports (#135, ADR-0013).

Two entry points, one per way a 5xx can be produced:

- `exception_handler` — DRF's `EXCEPTION_HANDLER`, covering every API view.
- `handler500` — Django's, covering the non-DRF pages (allauth, admin).

Both funnel into `record`, which is best-effort by design: a failure while recording a
failure must never replace the original error with a different one.
"""
import logging
import re
import sys
import traceback as traceback_module
from urllib.parse import parse_qsl, urlencode

from django.views.defaults import server_error
from rest_framework.views import exception_handler as drf_exception_handler

from .models import ErrorReport

logger = logging.getLogger(__name__)

BACKEND_5XX = "backend_5xx"

# The two things ADR-0013 says must never reach the table, for two different reasons:
# secrets, because storing a password anywhere is indefensible; `email`, because it isn't
# a secret but is the PII identity rides past — that's the `user` FK's job alone (#69).
# Matching keys are dropped, not masked: the issue asks for the value to be *gone*.
_DROPPED_KEY_MARKERS = (
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

# An address can also reach a report without ever being a key: an SMTP refusal or a
# duplicate-key IntegrityError puts what the visitor typed straight into the exception
# message, which is what `summary` and `traceback` store. Key filtering can't see that,
# so the free-text columns get a shape-based redaction on the way in.
_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]*\w")
_EMAIL_PLACEHOLDER = "[email removed]"

# Set on the underlying HttpRequest once a report is written, so a DRF exception that
# escapes to Django's handler500 isn't recorded twice for the one request.
_RECORDED_FLAG = "_error_report_recorded"


def _must_not_store(key):
    lowered = str(key).lower()
    return any(marker in lowered for marker in _DROPPED_KEY_MARKERS)


def _redact_emails(text):
    return _EMAIL_PATTERN.sub(_EMAIL_PLACEHOLDER, text) if text else text


def _max_length(field_name):
    return ErrorReport._meta.get_field(field_name).max_length


def _scrub_value(value):
    if isinstance(value, dict):
        return {k: _scrub_value(v) for k, v in value.items() if not _must_not_store(k)}
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


def _scrubbed_full_path(request):
    """The path with its query string, minus any parameter the key filter drops.

    Reproducing a GET failure needs its query string, and `request.path` throws it away —
    but a query string can carry a token, so it goes through the same filter as the body.
    """
    query = request.META.get("QUERY_STRING", "")
    if not query:
        return request.path
    kept = [
        (k, v) for k, v in parse_qsl(query, keep_blank_values=True) if not _must_not_store(k)
    ]
    return f"{request.path}?{urlencode(kept)}" if kept else request.path


def _body(request):
    """The request body, best-effort — an unreadable one is not worth a second error.

    `request.data` is DRF's parsed body and covers the API. Django's `handler500` hands us
    a plain HttpRequest instead, which has no `.data` — there, the allauth/admin form
    fields live in POST, and without this fallback those reports would carry no context.
    """
    try:
        return request.data
    except Exception:
        pass
    try:
        return request.POST.dict()
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
    return _redact_emails(f"{type(exc).__name__}: {exc}")[: _max_length("summary")]


def _fingerprint(exc, path):
    """`kind:what threw:where` — enough for the admin to group like failures."""
    marker = type(exc).__name__ if exc is not None else "unknown"
    return f"{BACKEND_5XX}:{marker}:{path}"[: _max_length("fingerprint")]


def _traceback(exc):
    if exc is None:
        return None
    formatted = traceback_module.format_exception(type(exc), exc, exc.__traceback__)
    return _redact_emails("".join(formatted))


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
        path = _scrubbed_full_path(http_request)
        ErrorReport.objects.create(
            session_id=session_id if isinstance(session_id, str) else "",
            kind=BACKEND_5XX,
            summary=_summary(exc, status_code),
            status_code=status_code,
            request_path=path[: _max_length("request_path")],
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
