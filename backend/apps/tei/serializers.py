from rest_framework import serializers
from .models import TEIDocument

class TEIDocumentListSerializer(serializers.ModelSerializer):
    class Meta:
        model = TEIDocument
        fields = ["id", "title", "language", "created_at"]


class TEIDocumentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = TEIDocument
        fields = ["id", "title", "language", "parsed_json", "meta", "created_at"]