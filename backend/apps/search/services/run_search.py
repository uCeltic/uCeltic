import re
from apps.tei.models import TEIDocument
from .similarity import moving_window_similarity1


_QUERY_WORD_RE = re.compile(r"\w+", re.UNICODE)


def run_search(doc_id: int, query: str, *,
                window_size_ratio: float = 1.3,
                step_size: int = 1,
                dissimilarity_threshold: float = 0.5,
                top_k: int = 10) -> list[dict]:
    doc = TEIDocument.objects.get(pk=doc_id)
    word_array = doc.word_array or []
    anchors = doc.anchors or []
    anchors_by_id = {a["id"]: a for a in anchors}

    query_words = _QUERY_WORD_RE.findall(query)
    if not query_words or not word_array:
        return []

    article_words = [item["w"] for item in word_array]
    window_size = max(1, int(len(query_words) * window_size_ratio))

    top = moving_window_similarity1(
        query_words, article_words, window_size, step_size, top_k,
    )

    results = []
    for score, word_idx in top[:top_k]:
        if score > dissimilarity_threshold:
            continue

        word_end = min(word_idx + window_size, len(word_array))

        # Rebuild snippet from word_array preserving separators.
        snippet = "".join(word_array[i]["w"] + (word_array[i].get("sep") or " ") for i in range(word_idx, word_end)).strip()

        anchor = anchors_by_id.get(word_array[word_idx]["a"])
        results.append({
            "score": score,
            "snippet": snippet,
            "word_start": word_idx,
            "word_end": word_end,
            "anchor_id": anchor["id"] if anchor else None,
            "anchor_tag": anchor["tag"] if anchor else None,
            "line_no": anchor.get("line_no") if anchor else None,
        })
    return results


