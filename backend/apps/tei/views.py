from rest_framework.generics import ListAPIView, RetrieveAPIView
from .models import TEIDocument
from .serializers import TEIDocumentListSerializer, TEIDocumentDetailSerializer
# Create your views here.

#Controller

# get all the TEI documents
class TEIDocumentListView(ListAPIView):
    # select_related: every row now serializes its work, and the catalogue is
    # fetched whole each time the opener is used — one join beats one query
    # per document.
    queryset = TEIDocument.objects.select_related("work").exclude(parsed_json=None)
    serializer_class = TEIDocumentListSerializer

# get a single TEI document
class TEIDocumentDetailView(RetrieveAPIView):
    # select_related: every row now serializes its work, and the catalogue is
    # fetched whole each time the opener is used — one join beats one query
    # per document.
    queryset = TEIDocument.objects.select_related("work").exclude(parsed_json=None)
    serializer_class = TEIDocumentDetailSerializer