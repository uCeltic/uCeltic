from django.contrib import admin

from .models import BehaviorEvent


@admin.register(BehaviorEvent)
class BehaviorEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "session_id", "client_ts", "server_ts", "app_version")
    list_filter = ("event_type", "app_version")
    search_fields = ("session_id",)
    ordering = ("-server_ts",)