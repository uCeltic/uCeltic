from django.contrib import admin

from .models import BehaviorEvent, QuestionnaireResponse


def _display_name(user):
    """Profile display name, falling back to a non-identifying label.

    Never falls back to email/username: the advisor asked the study views to avoid
    needlessly surfacing personal details (#69).
    """
    profile = getattr(user, "profile", None)
    display_name = profile.display_name if profile else ""
    return display_name or f"user #{user.pk}"


class ReadOnlyAdminMixin:
    """Collected study data: viewable for inspection, never addable or editable."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(BehaviorEvent)
class BehaviorEventAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("server_ts", "event_type", "user_display", "session_id")
    list_filter = ("user", "event_type")
    search_fields = ("session_id",)
    ordering = ("-server_ts",)
    list_select_related = ("user", "user__profile")

    @admin.display(description="user", ordering="user")
    def user_display(self, obj):
        return _display_name(obj.user) if obj.user_id else "—"


@admin.register(QuestionnaireResponse)
class QuestionnaireResponseAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("user_display", "skipped", "questionnaire_version", "session_id", "created_at")
    list_filter = ("user", "skipped")
    search_fields = ("session_id",)
    ordering = ("-created_at",)
    list_select_related = ("user", "user__profile")

    @admin.display(description="user", ordering="user")
    def user_display(self, obj):
        return _display_name(obj.user)