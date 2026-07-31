from django.conf import settings
from django.db import models

# closed taxonomy per ADR-0003 — anything outside this set is rejected, not logged
EVENT_TYPES = [
    "session_started",
    "document_opened",
    "document_closed",
    "search_performed",
    "search_param_changed",
    "result_navigated",
    "scope_changed",
    "mode_changed",
    "iiif_toggled",
    "font_size_changed",
    "tag_entity_selected",
    "feedback_submitted",
]


class BehaviorEvent(models.Model):
    session_id = models.CharField(max_length=64)
    event_type = models.CharField(max_length=32, choices=[(t, t) for t in EVENT_TYPES])
    payload = models.JSONField(default=dict, blank=True)
    client_ts = models.DateTimeField()
    server_ts = models.DateTimeField(auto_now_add=True)
    app_version = models.CharField(max_length=32)
    # ADR-0004/#68: who, if anyone, was signed in when this event happened. Stamped
    # server-side from request.user (see EventView.post) — a client-supplied value is
    # never trusted. NULL for anonymous traffic and for all rows recorded before #68.
    #
    # Study-cohort convention: cohort = BehaviorEvent.objects.filter(user__isnull=False).
    # Anonymous traffic stays recorded but is, by construction, outside the cohort.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="behavior_events",
    )

    class Meta:
        ordering = ["-server_ts"]

    def __str__(self):
        return f"{self.event_type} @ {self.server_ts:%Y-%m-%d %H:%M:%S}"


# Small closed set, like EVENT_TYPES above — but for a different reason: not a study
# taxonomy, just the capture points we know how to interpret. Slice 2 (#136) adds the
# frontend kinds.
ERROR_KINDS = [
    "backend_5xx",
]


class ErrorReport(models.Model):
    """A failure that broke the experience, stored so a developer can reproduce it.

    Deliberately *not* a BehaviorEvent (ADR-0013): an event is something the visitor did,
    drawn from a closed taxonomy; this is something that happened *to* them. The two
    tables line up only through `session_id`, a best-effort join key.
    """

    # Blank for most server-side reports: search and auth requests don't carry the
    # session id today (ADR-0013's stated consequence), so the join is by user/time.
    session_id = models.CharField(max_length=64, blank=True)
    kind = models.CharField(max_length=32, choices=[(k, k) for k in ERROR_KINDS])
    summary = models.CharField(max_length=255)
    status_code = models.PositiveIntegerField(null=True, blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    method = models.CharField(max_length=10, blank=True)
    # Everything needed to replay the request — for a search, its query and params.
    # Scrubbed of passwords and email before it gets here (see error_capture.scrub).
    context = models.JSONField(default=dict, blank=True)
    traceback = models.TextField(null=True, blank=True)
    # Groups like failures on the admin list page. Grouping only — reports are never
    # deduplicated at write time, so the count of rows stays the count of failures.
    fingerprint = models.CharField(max_length=255, blank=True)
    client_ts = models.DateTimeField(null=True, blank=True)
    server_ts = models.DateTimeField(auto_now_add=True)
    app_version = models.CharField(max_length=32, blank=True)
    # Stamped server-side from request.user, never trusted from the client — exactly as
    # BehaviorEvent.user above. NULL for anonymous traffic.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="error_reports",
    )

    class Meta:
        ordering = ["-server_ts"]

    def __str__(self):
        # No self.user, for the same reason QuestionnaireResponse.__str__ omits it (#69).
        return f"{self.kind} {self.request_path} @ {self.server_ts:%Y-%m-%d %H:%M:%S}"


# Single source of truth for question content (ADR-0004): the SPA fetches this via
# GET /api/questionnaire/ rather than keeping its own copy, so a content swap after the
# 2026-07-09 team meeting is a backend-only change. Bump the version whenever the
# question set changes so historical QuestionnaireResponse rows stay interpretable.
QUESTIONNAIRE_VERSION = 1
QUESTIONS = [
    {
        "id": "purpose",
        "prompt": "What is your main purpose using these manuscripts this time?",
        "type": "text",
    },
]


# Closed set, like EVENT_TYPES — but here it is a triage bucket a human sorts by, not a
# study taxonomy. `other` is the default so a visitor who just wants to write something
# never has to classify it first.
FEEDBACK_CATEGORIES = [
    "bug",
    "feature",
    "other",
]

# Length guard, not a throttle: ADR-0014 chose serializer max_length plus a submit button
# disabled in flight over rate limiting, so this number is the whole abuse defense for the
# prose field. Generous enough that no real bug report hits it.
FEEDBACK_BODY_MAX_LENGTH = 5000
FEEDBACK_CONTACT_MAX_LENGTH = 200


class Feedback(models.Model):
    """A message a visitor deliberately wrote to the team (#137, ADR-0014).

    Deliberately its own table, not a BehaviorEvent: an event is a closed-taxonomy intent
    the visitor performed, and this is free prose a human reads and triages. Its content
    must never enter the study stream — a successful submission emits only a
    `feedback_submitted` event carrying `{category}`, and the two line up through
    `session_id`.
    """

    # NULL for anonymous visitors — mirrors BehaviorEvent.user. Stamped server-side from
    # request.user (see FeedbackView.post); a client-supplied value is never trusted.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="feedback",
    )
    session_id = models.CharField(max_length=64)
    category = models.CharField(
        max_length=16,
        choices=[(c, c) for c in FEEDBACK_CATEGORIES],
        default="other",
    )
    body = models.TextField(max_length=FEEDBACK_BODY_MAX_LENGTH)
    # Free text, not an EmailField: whatever the visitor wants to be reached at (an email,
    # a handle, nothing at all). Blank is the common case — a signed-in submitter is
    # already reachable through their account.
    contact = models.CharField(max_length=FEEDBACK_CONTACT_MAX_LENGTH, blank=True)
    # Client snapshot — open documents, chosen work, viewport, url — so a bug report is
    # reproducible without the visitor describing their screen. Tool-usage state, the same
    # kind of thing BehaviorEvent.payload holds; never search or selection text.
    context = models.JSONField(default=dict, blank=True)
    app_version = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        # Neither the user nor the body: admin renders this into the change page's
        # <title>/breadcrumb, and the body is the one field here that can carry PII the
        # visitor typed (#69's reasoning, applied to prose rather than to a username).
        return f"{self.category} @ {self.created_at:%Y-%m-%d %H:%M:%S}"


class QuestionnaireResponse(models.Model):
    # NULL for anonymous visitors (ADR-0007) — mirrors BehaviorEvent.user above.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="questionnaire_responses",
    )
    session_id = models.CharField(max_length=64)
    questionnaire_version = models.PositiveIntegerField()
    # Null when skipped — distinguishes "declined to answer" from "answered with {}".
    answers = models.JSONField(null=True, blank=True)
    skipped = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        # No self.user here: Django's admin renders this string, unstyled, straight
        # into the change page's <title>/breadcrumb/heading — the same
        # personally-identifying username user_display exists to hide (#69). Who it
        # belongs to is already visible on that page via the User field.
        state = "skipped" if self.skipped else "answered"
        return f"{state} @ {self.created_at:%Y-%m-%d %H:%M:%S}"