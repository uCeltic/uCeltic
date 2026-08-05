from rest_framework.generics import ListAPIView, RetrieveAPIView
from .models import NameEntity, TEIDocument
from .serializers import (
    NameEntitySerializer,
    TEIDocumentDetailSerializer,
    TEIDocumentListSerializer,
)
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


# The corpus-wide name register the Tag Filter's menu is built from (#163).
#
# Unfiltered on purpose. Which entities are on offer depends on which columns
# are open and which Work is chosen, and both of those already live on the
# frontend — narrowing here would mean re-fetching the whole menu every time a
# column opens, closes or is dragged. The register is 91 rows on the corpus in
# hand and belongs to the corpus, not to a request, so it is fetched once and
# joined against each open document's own `name_index`.
class NameEntityListView(ListAPIView):
    queryset = NameEntity.objects.all()
    serializer_class = NameEntitySerializer
