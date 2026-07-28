from rest_framework import serializers
from .models import TEIDocument, Work


class WorkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Work
        fields = ["id", "name", "slug"]


# close to vo/dto, api return what fields to the frontend
class TEIDocumentListSerializer(serializers.ModelSerializer):
    # Nested rather than a bare id: the opener's first level is a list of work
    # NAMES, and it builds that by grouping this one catalogue response — a work
    # with no documents therefore never appears as an empty branch (#152).
    # `null` for a document that belongs to no work; it stays openable.
    work = WorkSerializer(read_only=True)

    class Meta:
        model = TEIDocument
        fields = ["id", "title", "language", "work", "created_at"]


class TEIDocumentDetailSerializer(serializers.ModelSerializer):
    # Carried on the detail too, so an OPEN document knows its own work — that
    # is what lets a work selection narrow the Tag Filter's entity menu (#147).
    work = WorkSerializer(read_only=True)

    class Meta:
        model = TEIDocument
        fields = [
            "id", "title", "language", "work",
            "parsed_json", "meta",
            "anchors", "word_array",      # NEW
            "created_at",
        ]
