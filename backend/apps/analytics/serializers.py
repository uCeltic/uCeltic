from rest_framework import serializers

from .models import EVENT_TYPES


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