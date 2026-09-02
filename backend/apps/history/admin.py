from django.contrib import admin

from apps.accounts.admin_user_display import UserDisplayAdminMixin, UserListFilter

from .models import SearchHistoryEntry


@admin.register(SearchHistoryEntry)
class SearchHistoryEntryAdmin(UserDisplayAdminMixin, admin.ModelAdmin):
    """The only way to look at a captured entry until the profile page reads them (#187).

    Read-only like the study admins, but for a different reason: these rows are a user's
    own record of what they searched, and an admin editing one would make the snapshot
    mutable — the one thing ADR-0024 says it is not.

    Whose entry it is reads as a display name, never the email-derived username, exactly
    as every other admin over a `user` FK (#69) — and the list page shows no `query`, for
    the same reason `Feedback` keeps `contact` off it: the query is text this person
    typed, and the list needs only enough to find the row.
    """

    list_display = ("created_at", "user_display", "query_origin", "version_count")
    list_filter = (UserListFilter, "query_origin")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    fields = (
        "created_at",
        "user_display",
        "query",
        "query_origin",
        "window_size_ratio",
        "step_size",
        "dissimilarity_threshold",
        "top_k",
        "versions",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="versions")
    def version_count(self, obj):
        return len(obj.versions)
