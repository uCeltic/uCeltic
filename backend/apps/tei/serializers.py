from rest_framework import serializers
from .models import NameEntity, TEIDocument, Work


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
            # How often THIS document writes each grouped name (#163). The
            # register says what a group id names; this says how loudly this
            # column says it, and the two are joined into the Tag Filter's rows
            # on the frontend, where the visible columns are already known.
            # `null` on a document parsed before the registry existed.
            "name_index",
            "created_at",
        ]


class NameEntitySerializer(serializers.ModelSerializer):
    """One row of the Tag Filter's menu, before it is narrowed to what is open.

    `code` is carried alongside the headword rather than kept internal: the menu
    prints both, because a researcher cross-checks against their own name lists
    and the `@nymRef` code is the only key those lists share with the app.
    `headword_source` is not — where a name came from is the register's own
    business, and shows the same row either way.
    """

    class Meta:
        model = NameEntity
        fields = ["code", "kind", "headword"]
