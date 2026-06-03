"""
  Manual benchmark for the sliding-window similarity matcher (Issue #2).

  Measures wall-clock time of moving_window_similarity1() on a large, reproducible
  synthetic corpus. NOT part of CI -- run by hand:

      python backend/scripts/bench_search.py

  How to compare before/after the RapidFuzz migration (Issue #1):
      1. Run this script on the current commit and record the printed seconds.
      2. git stash / check out the pre-RapidFuzz commit, re-run, record again.
      3. Same seed (42) + same params => identical workload => the delta is the
         speedup from the Levenshtein -> RapidFuzz swap.

  This is a pure-Python benchmark: no database or Django setup required.
"""
import random
import string
import sys
import time
from pathlib import Path

# Make `apps...` importable when run as `python backend/scripts/bench_search.py`
# from the repo root: backend/scripts/bench_search.py -> add backend/ to path.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from apps.search.services.similarity import moving_window_similarity1  # noqa: E402

# Reproducible workload -------------------------------------------------------
SEED = 42
CORPUS_SIZE = 5000        # number of words in the synthetic document
QUERY_SIZE = 8            # number of words in the search phrase
WINDOW_SIZE = 8           # sliding window width
STEP = 1


def random_word(rng):
    length = rng.randint(3, 10)
    return "".join(rng.choices(string.ascii_lowercase, k=length))


def build_corpus():
    rng = random.Random(SEED)
    total_words = [random_word(rng) for _ in range(CORPUS_SIZE)]
    # Pull the query from inside the corpus so there's a real best match.
    start = rng.randint(0, CORPUS_SIZE - QUERY_SIZE)
    target_words = total_words[start:start + QUERY_SIZE]
    return target_words, total_words


def main():
    target_words, total_words = build_corpus()
    print(
        f"corpus={CORPUS_SIZE} words, query={QUERY_SIZE} words, "
        f"window={WINDOW_SIZE}, step={STEP}, seed={SEED}"
    )

    start = time.perf_counter()
    results = moving_window_similarity1(
        target_words, total_words, WINDOW_SIZE, step=STEP
    )
    elapsed = time.perf_counter() - start

    best_score, best_index = results[0]
    print(f"best match: index={best_index} score={best_score:.4f}")
    print(f"elapsed: {elapsed:.3f} s")


if __name__ == "__main__":
    main()