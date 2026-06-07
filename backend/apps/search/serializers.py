from rest_framework import serializers


# request DTO for the search endpoint — defines and bounds each parameter
class SearchRequestSerializer(serializers.Serializer):
    query = serializers.CharField(
        help_text="Free-text query to search for within the document.",
    )
    doc_id = serializers.IntegerField(
        min_value=1,
        help_text="ID of the TEI document to search.",
    )
    window_size_ratio = serializers.FloatField(
        default=1.3, min_value=0.1, max_value=10.0,
        help_text="Sliding-window size as a multiple of the query word count.",
    )
    step_size = serializers.IntegerField(
        default=1, min_value=1,
        help_text="How many words the sliding window advances per step.",
    )
    dissimilarity_threshold = serializers.FloatField(
        default=0.5, min_value=0.0, max_value=1.0,
        help_text="Max dissimilarity (0 = identical) for a result to be kept.",
    )
    top_k = serializers.IntegerField(
        default=10, min_value=1, max_value=100,
        help_text="Maximum number of results to return.",
    )

# response DTO — documents the shape of each search hit
class SearchResultSerializer(serializers.Serializer):
    score = serializers.FloatField(help_text="Dissimilarity score (0 = identical).")
    snippet = serializers.CharField(help_text="Matched text snippet from the document.")
    word_start = serializers.IntegerField(help_text="Global index of the first matched word.")
    word_end = serializers.IntegerField(help_text="Global index just past the last matched word.")
    anchor_id = serializers.CharField(allow_null=True, help_text="ID of the enclosing TEI anchor.")
    anchor_tag = serializers.CharField(allow_null=True, help_text="Tag of the enclosing TEIanchor.")
    line_no = serializers.IntegerField(allow_null=True, help_text="Line number of the anchor, if any.")


class SearchResponseSerializer(serializers.Serializer):
    results = SearchResultSerializer(many=True)