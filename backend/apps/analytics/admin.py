from django.contrib import admin

# Shared with apps.history, which must not import this app (ADR-0024) — see the module's
# own docstring. Re-exported here because `UserListFilter` is part of every study admin's
# documented shape (apps/analytics/tests/test_admin.py).
from apps.accounts.admin_user_display import (  # noqa: F401
    UserDisplayAdminMixin,
    UserListFilter,
    display_name,
)

from .models import BehaviorEvent, ErrorReport, Feedback, QuestionnaireResponse


class StudyDataAdminMixin(UserDisplayAdminMixin):
    """Collected study data: read-only and shown by display name, not username (#69).

    Bundles everything both study-model admins share: add/edit is blocked (it's
    collected data, not something an admin authors), on top of the shared rule for
    naming a row's owner that `UserDisplayAdminMixin` carries.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(BehaviorEvent)
class BehaviorEventAdmin(StudyDataAdminMixin, admin.ModelAdmin):
    list_display = ("server_ts", "event_type", "user_display", "session_id")
    list_filter = (UserListFilter, "event_type")
    search_fields = ("session_id",)
    ordering = ("-server_ts",)
    # Swaps the `user` FK for `user_display` on the read-only detail view too — Django
    # forces every field readonly here (has_change_permission is False), so without
    # this override the raw FK would render via User.__str__ same as the old filter did.
    fields = ("session_id", "event_type", "payload", "client_ts", "server_ts", "app_version", "user_display")


@admin.register(ErrorReport)
class ErrorReportAdmin(StudyDataAdminMixin, admin.ModelAdmin):
    """The dashboard a developer reproduces a failure from (#135, ADR-0013)."""

    list_display = ("server_ts", "kind", "status_code", "request_path", "user_display", "fingerprint")
    list_filter = (UserListFilter, "kind", "status_code")
    search_fields = ("session_id", "fingerprint")
    ordering = ("-server_ts",)
    fields = (
        "server_ts",
        "kind",
        "summary",
        "status_code",
        "method",
        "request_path",
        "context",
        "traceback",
        "fingerprint",
        "session_id",
        "client_ts",
        "app_version",
        "user_display",
    )


@admin.register(QuestionnaireResponse)
class QuestionnaireResponseAdmin(StudyDataAdminMixin, admin.ModelAdmin):
    list_display = ("user_display", "skipped", "questionnaire_version", "session_id", "created_at")
    list_filter = (UserListFilter, "skipped")
    search_fields = ("session_id",)
    ordering = ("-created_at",)
    fields = ("user_display", "session_id", "questionnaire_version", "answers", "skipped", "created_at")

@admin.register(Feedback)
class FeedbackAdmin(StudyDataAdminMixin, admin.ModelAdmin):
    """The triage surface for what visitors wrote to us (#137, ADR-0014).

    Same read-only mixin as the study models, for a different reason: this is a message
    someone sent, so editing it would rewrite their words.

    The list page says only *whether* a reply is possible, not the address itself —
    `contact` is visitor-supplied PII, and #69's rule for the list pages (say enough to
    triage, keep the personal detail on the detail page) applies to it as much as to a
    username.
    """

    list_display = ("created_at", "category", "user_display", "reply_requested", "session_id")
    list_filter = (UserListFilter, "category")
    search_fields = ("session_id",)
    ordering = ("-created_at",)

    @admin.display(description="reply requested", boolean=True, ordering="contact")
    def reply_requested(self, obj):
        return bool(obj.contact)

    fields = (
        "created_at",
        "category",
        "body",
        "contact",
        "context",
        "session_id",
        "app_version",
        "user_display",
    )
