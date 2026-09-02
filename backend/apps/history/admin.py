from django.contrib import admin

from .models import SearchHistoryEntry


@admin.register(SearchHistoryEntry)
class SearchHistoryEntryAdmin(admin.ModelAdmin):
    """Read-only, like the study admins — but for a different reason: these rows are a
    user's own record of what they searched, and an admin editing one would make the
    snapshot mutable, which is the one thing ADR-0024 says it is not.
    """

    list_display = ("__str__", "user", "query_origin", "version_count")
    list_filter = ("query_origin", "created_at")
    list_select_related = ("user",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]

    @admin.display(description="versions")
    def version_count(self, obj):
        return len(obj.versions)
