from django.contrib import admin
from .models import TEIDocument
# Register your models here.

#admin panel fields display and readonly fields
@admin.register(TEIDocument)
class TEIDocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'language', 'uploaded_by', 'created_at']
    readonly_fields = ['parsed_json', 'meta', 'created_at', 'updated_at']
