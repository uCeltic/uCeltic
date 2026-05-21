from apps.tei.models import TEIDocument
from .tokenize import tokenization_with_index
from .similarity import moving_window_similarity1

SCROLL_TARGET_TAGS = {
      "p", "l", "lg", "seg", "head", "ab",
      "opener", "closer", "trailer", "signed", "note",
      }


def run_search(doc_id: int, query: str, *,
                window_size_ratio: float = 1.3,
                step_size: int = 1,
                dissimilarity_threshold: float = 0.5,
                top_k: int = 10) -> list[dict]:
    doc = TEIDocument.objects.get(pk=doc_id)
    article = doc.plain_text or ""
    anchors = doc.anchors or []

    target_words, _ = tokenization_with_index(query)
    article_tokens, token_indices = tokenization_with_index(article)
    if not target_words or not article_tokens:
        return []

    # robustness check for window size: if target_words is 1 and ratio is 0.5, then window_size should be 1
    window_size = max(1, int(len(target_words) * window_size_ratio))

    top = moving_window_similarity1(
        target_words, article_tokens, window_size, step_size, top_k,
    )

    results = []
    for score, idx in top[:top_k]:
        if score > dissimilarity_threshold:
            continue
        if idx + window_size <= len(article_tokens):
            start = token_indices[idx][0]
            end = token_indices[idx + window_size - 1][1]
        else:
            start = token_indices[idx][0]
            end = len(article)
        snippet = article[start:end]

        # All SCROLL_TARGET elements whose range overlaps [start, end) — used
        # to highlight every line/paragraph the match window covers, not just
        # the one containing `start`.
        overlapping = [
            a for a in anchors
            if a["tag"] in SCROLL_TARGET_TAGS
            and a["text_start"] < end and a["text_end"] > start
        ]
        # Primary scroll target: the first overlapping SCROLL_TARGET, or the
        # innermost anchor containing `start` if nothing overlaps.
        if overlapping:
            scroll_anchor = overlapping[0]
        else:
            hits = [a for a in anchors if a["text_start"] <= start < a["text_end"]]
            scroll_anchor = max(hits, key=lambda a: a["text_start"]) if hits else None

        results.append({
            "score": score,
            "snippet": snippet,
            "match_start": start,
            "match_end": end,
            "anchor_id": scroll_anchor["id"] if scroll_anchor else None,
            "anchor_tag": scroll_anchor["tag"] if scroll_anchor else None,
            "line_no": scroll_anchor["line_no"] if scroll_anchor else None,
            "highlight_anchor_ids": [a["id"] for a in overlapping],
        })
    return results