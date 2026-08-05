from django.contrib import admin
from .models import NameEntity, TEIDocument, Work
# Register your models here.


# The one place a human can say what `F64` is called. The corpus never does —
# it groups 670 named entities under 91 bare ids and explains none of them — so
# the headword the parser derives is a best guess from the spellings, and this
# is where a researcher overrules it (#163).
@admin.register(NameEntity)
class NameEntityAdmin(admin.ModelAdmin):
    list_display = ['headword', 'code', 'kind', 'headword_source', 'updated_at']
    list_filter = ['kind', 'headword_source']
    search_fields = ['headword', 'code']
    # `code` is the corpus's, not ours: it is the join key every occurrence
    # carries, and editing it here would orphan the group rather than rename it.
    # `kind` is recomputed from the corpus on every upload, so a value typed
    # here would not survive one.
    readonly_fields = ['code', 'kind', 'headword_source', 'created_at', 'updated_at']

    def has_add_permission(self, request):
        # An entity exists because a manuscript names it. One added by hand
        # would be an option that can never match anything, which is the
        # property this menu was rebuilt to have (#147).
        return False

    def save_model(self, request, obj, form, change):
        # An admin edit wins forever. Marking it `manual` is what a future
        # second source for this field — the team's own person_name_list.csv /
        # place_name_list.csv — will have to respect, alongside the rule that
        # already protects it: a headword is fixed on first sighting and no
        # upload recomputes it.
        if 'headword' in form.changed_data:
            obj.headword_source = NameEntity.MANUAL
        super().save_model(request, obj, form, change)


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
