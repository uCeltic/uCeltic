"""How a row's owner is shown in the admin, wherever a model has a `user` FK.

Lives in `accounts` because the answer is the Profile's display name, and because the
models that need it now sit in two apps that must not import each other: the study
stream (`analytics`) and the user's own Search History (`history`), which ADR-0024
keeps deliberately apart.

The rule is #69's: the admin says enough to tell whose row this is, and never the
allauth username derived from the person's email.
"""
from django.contrib import admin
from django.contrib.auth import get_user_model


def display_name(user):
    """Profile display name, falling back to a non-identifying label.

    Never falls back to email/username: the advisor asked the admin views to avoid
    needlessly surfacing personal details (#69).
    """
    profile = getattr(user, "profile", None)
    name = profile.display_name if profile else ""
    return name or f"user #{user.pk}"


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
        choices = [(str(user.pk), display_name(user)) for user in users]
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


class UserDisplayAdminMixin:
    """Renders the `user` column and field through `display_name`, not User.__str__.

    Whether the rows are editable is a separate question each admin answers for itself;
    this mixin only owns how their owner is named.
    """

    list_select_related = ("user", "user__profile")

    @admin.display(description="user", ordering="user")
    def user_display(self, obj):
        return display_name(obj.user) if obj.user_id else "—"
