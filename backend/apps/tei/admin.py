from django.contrib import admin
from .models import TEIDocument, Work
# Register your models here.


# Registered so the work field on the TEI document form gets the admin's
# select-plus-add widget: an uploader can pick an existing work or create one
# without leaving the upload page (#152).
@admin.register(Work)
class WorkAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'document_count', 'created_at']
    search_fields = ['name', 'slug']
    # Left blank on the form; the model derives it from the name.
    readonly_fields = ['slug', 'created_at']

    @admin.display(description='Documents')
    def document_count(self, work):
        return work.documents.count()


#admin panel fields display and readonly fields
@admin.register(TEIDocument)
class TEIDocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'work', 'language', 'uploaded_by', 'created_at']
    # Assigning the corpus's existing documents to their work is done from here.
    list_filter = ['work']
    autocomplete_fields = ['work']
    readonly_fields = ['parsed_json', 'meta', 'created_at', 'updated_at']
