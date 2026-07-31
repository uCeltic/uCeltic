from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import BehaviorEvent, ErrorReport, Feedback, QuestionnaireResponse


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


class StudyDataAdminMixin:
    """Collected study data: read-only and shown by display name, not username (#69).

    Bundles everything both study-model admins share: add/edit is blocked (it's
    collected data, not something an admin authors), and the `user` column/field is
    rendered through `user_display` rather than Django's default User.__str__.
    """

    list_select_related = ("user", "user__profile")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="user", ordering="user")
    def user_display(self, obj):
        return _display_name(obj.user) if obj.user_id else "—"


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
    someone sent, so editing it would rewrite their words. `contact` earns a column —
    it is the one field that decides whether a submission can be answered at all.
    """

    list_display = ("created_at", "category", "user_display", "contact", "session_id")
    list_filter = (UserListFilter, "category")
    search_fields = ("session_id",)
    ordering = ("-created_at",)
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
