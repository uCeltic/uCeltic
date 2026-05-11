from apps.tei.models import TEIDocument
from .tokenize import tokenization_with_index
from .similarity import moving_window_similarity1

SCROLL_TARGET_TAGS = {
      "p", "l", "lg", "seg", "head", "ab",
      "opener", "closer", "trailer", "signed", "note",
      }


def run_search(doc_id: int, query: str, *,
                window_size_ratio: float = 0.5,
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

        hits = [a for a in anchors if a["text_start"] <= start < a["text_end"]]
        candidates = [a for a in hits if a["tag"] in SCROLL_TARGET_TAGS]
        scroll_anchor = (
            max(candidates, key=lambda a: a["text_start"])
            if candidates else (max(hits, key=lambda a: a["text_start"]) if hits else None)
        )

        results.append({
            "score": score,
            "snippet": snippet,
            "match_start": start,
            "match_end": end,
            "anchor_id": scroll_anchor["id"] if scroll_anchor else None,
            "anchor_tag": scroll_anchor["tag"] if scroll_anchor else None,
            "line_no": scroll_anchor["line_no"] if scroll_anchor else None,
        })
    return results