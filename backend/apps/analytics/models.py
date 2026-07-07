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

    class Meta:
        ordering = ["-server_ts"]

    def __str__(self):
        return f"{self.event_type} @ {self.server_ts:%Y-%m-%d %H:%M:%S}"