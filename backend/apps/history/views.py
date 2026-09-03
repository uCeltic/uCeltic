from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MAX_ENTRIES_PER_USER, SearchHistoryEntry
from .serializers import (
    SearchHistoryEntryRequestSerializer,
    SearchHistoryEntryResponseSerializer,
)


class SearchHistoryView(APIView):
    """The signed-in user's own Search History: capture one search (#187), read
    them all (#188).

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

    @extend_schema(
        responses={200: SearchHistoryEntryResponseSerializer(many=True)},
        description=(
            "The signed-in user's own search history, newest first, as the immutable "
            "snapshots they were captured as. At most 50 entries — the store rolls."
        ),
    )
    def get(self, request):
        # Filtered by the session's user, never by anything the caller passes: an entry is
        # readable by the person who searched and by nobody else (ADR-0024). Unpaginated on
        # purpose — the cap is what bounds the response, and `-created_at, -pk` (the model's
        # Meta) is the newest-first order the profile reads them in.
        #
        # The slice repeats a bound `capture()` already keeps, so that what a user reads is
        # the most recent 50 whatever put the rows there: an admin, an import, or a data
        # migration never went through the manager that trims.
        entries = SearchHistoryEntry.objects.filter(user=request.user)[
            :MAX_ENTRIES_PER_USER
        ]
        return Response(SearchHistoryEntryResponseSerializer(entries, many=True).data)
