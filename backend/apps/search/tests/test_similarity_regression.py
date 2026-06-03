

# backend/apps/search/tests/test_similarity_regression.py
  #
  # Regression test: verify that the scores of moving_window_similarity1 remain unchanged 
  # after replacing the underlying library.
  # Strategy: call the public function, fix the input, 
  # assert the output score is unchanged within the floating point tolerance 
  # —— test "behavior" not "implementation".
  #
  # Use Django's SimpleTestCase (pure function, no database access) so it can be discovered by `manage.py test`
  # and counted by coverage, and will be covered by the CI gate for #8.

from django.test import SimpleTestCase

from apps.search.services.similarity import moving_window_similarity1


class MovingWindowSimilarityRegressionTests(SimpleTestCase):
# ── basic hit ─────────────────────────────────────────────
    def test_exact_match_scores_zero(self):
        """exact match, dissimilarity should be 0.0 (best score)."""
       
        query = ["Fionn", "mac", "Cumaill"]
        doc   = ["Fionn", "mac", "Cumaill"]
        results = moving_window_similarity1(query, doc, actual_window_size=3, step=1, top_k=1)

        best_score, best_idx = results[0]
        self.assertAlmostEqual(best_score, 0.0, delta=1e-9)
        self.assertEqual(best_idx, 0)

    def test_no_match_scores_high(self):
        """completely unrelated words, the best score should be significantly higher than 0."""
        
        query = ["Fionn"]
        doc   = ["zzzzz", "qqqqq", "xxxxx"]
        results = moving_window_similarity1(query, doc, actual_window_size=1, step=1, top_k=1)

        best_score, _ = results[0]
        self.assertGreater(best_score, 0.5)

# ── fixed score regression (core)──────────────────────────────────
    def test_known_scores_do_not_drift(self):
        """
        Use a set of known inputs to lock the score for each window position —— this is the "regression nail".
        After replacing the library, run this and the scores should be the same,
        indicating the behavior hasn't changed. The expected values are filled in after running the old Levenshtein library.
        """
        
        query = ["find", "mac"]
        doc   = ["find", "mac", "cumaill", "agus", "find", "mor"]
        results = moving_window_similarity1(query, doc, actual_window_size=2, step=1, top_k=10)

        by_idx = {idx: score for score, idx in results}

        # window [0,2): ["find","mac"] vs ["find","mac"] → completely same
        self.assertAlmostEqual(by_idx[0], 0.0, delta=1e-6)
        # window [4,6): ["find","mac"] vs ["find","mor"], "mac" vs "mor" normalized distance 1/3
        self.assertAlmostEqual(by_idx[4], 0.333, delta=1e-3)

# ── sorting ─────────────────────────────────────────────────
    def test_results_are_sorted_best_first(self):
        """the results should be sorted by dissimilarity in ascending order (lower scores are better)."""

        query = ["abc"]
        doc   = ["abc", "xyz", "abc", "ijk", "abc"]
        results = moving_window_similarity1(query, doc, actual_window_size=1, step=1, top_k=2)

        scores = [s for s, _ in results]
        self.assertEqual(scores, sorted(scores))
        self.assertAlmostEqual(scores[0], 0.0, delta=1e-9)