from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SearchHistoryEntry
from .serializers import SearchHistoryEntryRequestSerializer


class SearchHistoryView(APIView):
    """Capture one settled search onto the signed-in user's own log (#187, ADR-0024).

    `IsAuthenticated`, unlike every other ingest endpoint in this codebase: Search History
    belongs to a User and an anonymous visitor keeps none. The client already declines to
    post while signed out, so a 403 here is a second line, not the user-facing rule.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=SearchHistoryEntryRequestSerializer,
        responses={201: None},
        description=(
            "Store one settled search as an immutable snapshot on the signed-in user's "
            "search history, dropping their oldest entry beyond the most recent 50."
        ),
    )
    def post(self, request):
        serializer = SearchHistoryEntryRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST
            )
        # Attribution is stamped from the session, never read from the body — the same
        # rule the study endpoints follow (#68), and here it is also what makes the
        # 50-entry cap and every later read belong to the right person.
        SearchHistoryEntry.objects.capture(
            user=request.user, **serializer.validated_data
        )
        return Response(status=status.HTTP_201_CREATED)
