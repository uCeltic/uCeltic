from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.tei.models import TEIDocument
from .services.run_search import run_search


# controller for the search api
class SearchView(APIView):
    def post(self, request):
        data = request.data
        doc_id = data.get('doc_id')
        query = (data.get('query') or "").strip()
        if not doc_id or not query:
            return Response(
                {"error": "doc_id and query are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            doc_id = int(doc_id)
            window_size_ratio = float(data.get('window_size_ratio', 1.3))
            step_size = int(data.get('step_size', 1))
            dissimilarity_threshold = float(data.get('dissimilarity_threshold', 0.5))
            top_k = int(data.get('top_k', 10))
        except (TypeError, ValueError):
            return Response(
                {"error": "numeric parameters must be valid numbers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            results = run_search(
                doc_id=doc_id,
                query=query,
                window_size_ratio=window_size_ratio,
                step_size=step_size,
                dissimilarity_threshold=dissimilarity_threshold,
                top_k=top_k,
            )
        except TEIDocument.DoesNotExist:
            return Response({"error": "Document not found"}, status=404)
        return Response({"results": results})

import math  # deliberate lint break
