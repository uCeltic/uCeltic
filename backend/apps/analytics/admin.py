from django.contrib import admin

from .models import BehaviorEvent, QuestionnaireResponse


@admin.register(BehaviorEvent)
class BehaviorEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "session_id", "client_ts", "server_ts", "app_version")
    list_filter = ("event_type", "app_version")
    search_fields = ("session_id",)
    ordering = ("-server_ts",)


@admin.register(QuestionnaireResponse)
class QuestionnaireResponseAdmin(admin.ModelAdmin):
    list_display = ("user", "skipped", "questionnaire_version", "session_id", "created_at")
    list_filter = ("skipped", "questionnaire_version")
    search_fields = ("session_id", "user__email")
    ordering = ("-created_at",)