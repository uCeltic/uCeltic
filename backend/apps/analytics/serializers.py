from rest_framework import serializers

from .models import EVENT_TYPES


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