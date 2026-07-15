from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import BehaviorEvent, QuestionnaireResponse


def _display_name(user):
    """Profile display name, falling back to a non-identifying label.

    Never falls back to email/username: the advisor asked the study views to avoid
    needlessly surfacing personal details (#69).
    """
    profile = getattr(user, "profile", None)
    display_name = profile.display_name if profile else ""
    return display_name or f"user #{user.pk}"


class UserListFilter(admin.SimpleListFilter):
    """The `user` FK filter, but the sidebar reads like `user_display` below.

    Django's default FK filter renders each option via User.__str__ — the
    allauth-generated username, which is derived from the email's local part. That
    would leak an email-derived string in the same sidebar whose table body was
    rewritten to hide exactly that (#69).
    """

    title = "user"
    parameter_name = "user"
    _ANONYMOUS = "anonymous"

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request)
        user_ids = qs.exclude(user__isnull=True).values_list("user_id", flat=True).distinct()
        users = get_user_model().objects.filter(pk__in=user_ids).select_related("profile")
        choices = [(str(user.pk), _display_name(user)) for user in users]
        if model_admin.model._meta.get_field("user").null and qs.filter(user__isnull=True).exists():
            choices.append((self._ANONYMOUS, "Anonymous"))
        return choices

    def queryset(self, request, queryset):
        value = self.value()
        if value == self._ANONYMOUS:
            return queryset.filter(user__isnull=True)
        if value:
            return queryset.filter(user_id=value)
        return queryset


class ReadOnlyAdminMixin:
    """Collected study data: viewable for inspection, never addable or editable."""

    list_select_related = ("user", "user__profile")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="user", ordering="user")
    def user_display(self, obj):
        return _display_name(obj.user) if obj.user_id else "—"


@admin.register(BehaviorEvent)
class BehaviorEventAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("server_ts", "event_type", "user_display", "session_id")
    list_filter = (UserListFilter, "event_type")
    search_fields = ("session_id",)
    ordering = ("-server_ts",)


@admin.register(QuestionnaireResponse)
class QuestionnaireResponseAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("user_display", "skipped", "questionnaire_version", "session_id", "created_at")
    list_filter = (UserListFilter, "skipped")
    search_fields = ("session_id",)
    ordering = ("-created_at",)