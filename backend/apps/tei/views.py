from rest_framework.generics import ListAPIView, RetrieveAPIView
from .models import TEIDocument
from .serializers import TEIDocumentListSerializer, TEIDocumentDetailSerializer
# Create your views here.


class TEIDocumentListView(ListAPIView):
    queryset = TEIDocument.objects.exclude(parsed_json=None)
    serializer_class = TEIDocumentListSerializer


class TEIDocumentDetailView(RetrieveAPIView):
    queryset = TEIDocument.objects.exclude(parsed_json=None)
    serializer_class = TEIDocumentDetailSerializer