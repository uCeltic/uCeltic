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


class QuestionnaireResponse(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="questionnaire_responses"
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
        state = "skipped" if self.skipped else "answered"
        return f"{state} by {self.user} @ {self.created_at:%Y-%m-%d %H:%M:%S}"