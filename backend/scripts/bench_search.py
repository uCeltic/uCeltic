"""
  Manual benchmark for the sliding-window similarity matcher (Issues #2, #17).

  Reports the speedup of the #17 lower-bound prefilter against the pre-#17
  algorithm (which rebuilt the Q x window distance matrix for EVERY window).
  On a realistic ~8000-word doc, same seed (42) => identical workload => the
  delta is the #17 speedup. NOT part of CI -- run by hand:

      python backend/scripts/bench_search.py

  Pure-Python: no database or Django setup required.
"""
import random
import string
import sys
import time
from pathlib import Path

# Make `apps...` importable when run from the repo root.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from rapidfuzz.distance import Levenshtein  # noqa: E402

from apps.search.services.similarity import (  # noqa: E402
    calculate_dissimilarity_score,
    moving_window_similarity1,
)

# Reproducible workload -------------------------------------------------------
SEED = 42
CORPUS_SIZE = 8000        # realistic document length (#17)
QUERY_SIZES = (8, 16)     # acceptance: >=10x at Q=8 and Q=16
STEP = 1
THRESHOLD = 0.5           # run_search's default interactive threshold
WINDOW_RATIO = 1.3        # matches run_search window_size_ratio


def random_word(rng):
    length = rng.randint(3, 10)
    return "".join(rng.choices(string.ascii_lowercase, k=length))


def build_corpus(rng):
    return [random_word(rng) for _ in range(CORPUS_SIZE)]


def old_full_scan(target_words, total_words, window, step):
    """Pre-#17 baseline: rebuild the Q x window matrix for EVERY window
    (the W-times redundant RapidFuzz recompute the prefilter removes)."""
    results = []
    q = len(target_words)
    for i in range(0, len(total_words) - window + 1, step):
        src = total_words[i:i + window]
        matrix = [[Levenshtein.normalized_distance(t, s) for s in src]
                  for t in target_words]
        scores = calculate_dissimilarity_score(matrix, window)
        results.append((sum(scores) / q, i))
    return sorted(results)


def timed(fn):
    start = time.perf_counter()
    results = fn()
    return (time.perf_counter() - start), results


def main():
    rng = random.Random(SEED)
    corpus = build_corpus(rng)
    print(
        f"corpus={CORPUS_SIZE} words, step={STEP}, "
        f"threshold={THRESHOLD}, seed={SEED}\n"
    )

    for q in QUERY_SIZES:
        # Pull the query from inside the corpus so there's a real best match.
        start = rng.randint(0, CORPUS_SIZE - q)
        query = corpus[start:start + q]
        window = max(1, int(q * WINDOW_RATIO))

        base_t, base_r = timed(
            lambda: old_full_scan(query, corpus, window, STEP)
        )
        pruned_t, pruned_r = timed(
            lambda: moving_window_similarity1(
                query, corpus, window, step=STEP, top_k=10,
                dissimilarity_threshold=THRESHOLD,
            )
        )

        speedup = base_t / pruned_t if pruned_t else float("inf")
        same_best = base_r[0][1] == pruned_r[0][1]
        print(
            f"Q={q:<2} window={window:<3} "
            f"old={base_t * 1000:8.1f} ms  "
            f"prefilter={pruned_t * 1000:7.1f} ms  "
            f"speedup={speedup:5.1f}x  "
            f"best_idx_match={same_best}"
        )


if __name__ == "__main__":
    main()
