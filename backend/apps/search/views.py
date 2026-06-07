from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.tei.models import TEIDocument
from .services.run_search import run_search
from drf_spectacular.utils import extend_schema
from .serializers import SearchRequestSerializer, SearchResponseSerializer
# controller for the search api
class SearchView(APIView):

    @extend_schema(
          request=SearchRequestSerializer,
          responses=SearchResponseSerializer,
          description="Run a moving-window similarity search over a TEI document.")
    def post(self, request):
        serializer = SearchRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        params = serializer.validated_data
        try:
            results = run_search(
                doc_id=params['doc_id'],
                query=params['query'],
                window_size_ratio=params['window_size_ratio'],
                step_size=params['step_size'],
                dissimilarity_threshold=params['dissimilarity_threshold'],
                top_k=params['top_k'],
            )
        except TEIDocument.DoesNotExist:
            return Response({"error": "Document not found"}, status=404)
        return Response({"results": results})
