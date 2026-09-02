from rest_framework import serializers

from .models import (
    MAX_HITS_PER_VERSION,
    MAX_VERSIONS_PER_ENTRY,
    QUERY_MAX_LENGTH,
    QUERY_ORIGINS,
    SNIPPET_MAX_LENGTH,
    TITLE_MAX_LENGTH,
)


class SearchHitSerializer(serializers.Serializer):
    """One matched passage, frozen as text. `score` is a *dissimilarity* (0 = identical),
    stored exactly as the search returned it; turning it into a match percentage is the
    reader's job, not the store's (ADR-0024)."""

    snippet = serializers.CharField(max_length=SNIPPET_MAX_LENGTH, allow_blank=True)
    # No upper bound: today every score is <= the dissimilarity threshold, whose slider
    # tops out at 1, but the search API documents none (apps/search/serializers.py) and a
    # matcher change that returned a larger one must not make entries vanish.
    score = serializers.FloatField(min_value=0.0)


class VersionSnapshotSerializer(serializers.Serializer):
    """One column that returned: the Version's title as text — never an id pointing at a
    TEI Document — and its hits, empty for a column that found nothing."""

    title = serializers.CharField(max_length=TITLE_MAX_LENGTH, allow_blank=True)
    hits = SearchHitSerializer(many=True, allow_empty=True, max_length=MAX_HITS_PER_VERSION)


class SearchHistoryEntryRequestSerializer(serializers.Serializer):
    """The snapshot the client assembles once its search run has settled.

    The results only ever exist client-side — the search API computes them per request
    and stores nothing — so the client is the only place this snapshot can come from.
    What the client is *not* trusted with is who it belongs to: there is no user field
    here, so a stray one in the body is dropped by validation, and the view stamps
    `request.user` instead.

    The bounds below are the whole abuse defense on a write-enabled endpoint, in the
    spirit of the Feedback length guards (ADR-0014): every one of them is far above what
    a real workspace can produce (8 columns, top_k ≤ 100).
    """

    query = serializers.CharField(max_length=QUERY_MAX_LENGTH, trim_whitespace=True)
    query_origin = serializers.ChoiceField(choices=QUERY_ORIGINS)
    window_size_ratio = serializers.FloatField(min_value=0.1, max_value=10.0)
    step_size = serializers.IntegerField(min_value=1)
    dissimilarity_threshold = serializers.FloatField(min_value=0.0, max_value=1.0)
    top_k = serializers.IntegerField(min_value=1, max_value=100)
    # `allow_empty=False` is the "an all-errored search is not stored" rule: errored
    # columns are left out client-side, so a search where every column errored arrives
    # here with nothing in it and is refused rather than stored as an empty record.
    versions = VersionSnapshotSerializer(
        many=True, allow_empty=False, max_length=MAX_VERSIONS_PER_ENTRY
    )
