import json

from rest_framework import serializers

from .models import (
    EVENT_TYPES,
    FEEDBACK_BODY_MAX_LENGTH,
    FEEDBACK_CATEGORIES,
    FEEDBACK_CONTACT_MAX_LENGTH,
    FEEDBACK_CONTEXT_MAX_CHARS,
)


# response DTO for GET /api/questionnaire/ — one code location (models.py QUESTIONS)
# is the source of truth; the SPA renders whatever this returns.
class QuestionSerializer(serializers.Serializer):
    id = serializers.CharField()
    prompt = serializers.CharField()
    type = serializers.CharField()


class QuestionnaireDefinitionSerializer(serializers.Serializer):
    version = serializers.IntegerField()
    questions = QuestionSerializer(many=True)


# request DTO for the submission endpoint. `skipped` always wins over `answers`: a
# skip must round-trip cleanly even if a caller (bug or not) sends stray answers
# alongside it, since a skip is meant to record "declined to answer", not the answers.
class QuestionnaireResponseRequestSerializer(serializers.Serializer):
    session_id = serializers.CharField(
        max_length=64,
        help_text="The same session_id used for this sitting's Behavior Events.",
    )
    skipped = serializers.BooleanField(default=False)
    answers = serializers.JSONField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Required unless skipped.",
    )

    def validate(self, attrs):
        if attrs.get("skipped"):
            attrs["answers"] = None
        elif not attrs.get("answers"):
            raise serializers.ValidationError({"answers": "Required unless skipped."})
        return attrs


# request DTO for the ingest endpoint — validates event_type against the closed set
class BehaviorEventRequestSerializer(serializers.Serializer):
    session_id = serializers.CharField(
        max_length=64,
        help_text="Uuid identifying one continuous app-load sitting.",
    )
    event_type = serializers.ChoiceField(
        choices=EVENT_TYPES,
        help_text="One of the closed taxonomy of behavior event types.",
    )
    payload = serializers.JSONField(
        default=dict,
        help_text="Event-specific fields; shape depends on event_type.",
    )
    client_ts = serializers.DateTimeField(
        help_text="When the event happened in the browser.",
    )
    app_version = serializers.CharField(
        max_length=32,
        help_text="Build-injected version of the client that emitted the event.",
    )


# request DTO for POST /api/feedback/. No `user` field on purpose: attribution is
# stamped from request.user in the view, so a stray one in the body is dropped here
# before it can reach the model (same rule as BehaviorEventRequestSerializer above).
#
# The max_length guards are the abuse defense ADR-0014 chose in place of a throttle,
# so they belong here rather than only on the model.
class FeedbackRequestSerializer(serializers.Serializer):
    session_id = serializers.CharField(
        max_length=64,
        help_text="The same session_id used for this sitting's Behavior Events.",
    )
    category = serializers.ChoiceField(
        choices=FEEDBACK_CATEGORIES,
        default="other",
        help_text="Triage bucket: bug, feature, or other.",
    )
    body = serializers.CharField(
        max_length=FEEDBACK_BODY_MAX_LENGTH,
        trim_whitespace=True,
        help_text="The message itself. Required — a feedback with nothing written is nothing.",
    )
    contact = serializers.CharField(
        max_length=FEEDBACK_CONTACT_MAX_LENGTH,
        required=False,
        allow_blank=True,
        default="",
        help_text="Optional: how an anonymous submitter would like to be replied to.",
    )
    context = serializers.JSONField(
        required=False,
        default=dict,
        help_text="Client snapshot (open documents, work, viewport, url) for reproducing a report.",
    )
    app_version = serializers.CharField(
        max_length=32,
        help_text="Build-injected version of the client that sent the feedback.",
    )

    def validate_context(self, value):
        # A JSONField accepts any json at all, which would leave the one unguarded field
        # on the endpoint. Shape first — the model's default is `{}` and admin renders it
        # as a mapping — then size, the same cheap guard `body` and `contact` get.
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        if len(json.dumps(value)) > FEEDBACK_CONTEXT_MAX_CHARS:
            raise serializers.ValidationError("Snapshot is too large.")
        return value
