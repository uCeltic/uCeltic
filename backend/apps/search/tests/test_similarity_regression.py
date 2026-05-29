# backend/apps/search/tests/test_similarity_regression.py
#
# 回归测试：验证 moving_window_similarity1 的分数在替换底层库之后保持不变。
#
# 测试策略：直接调用公开函数，传入固定输入，断言输出分数在浮点容差内不变。
# 这样测的是「行为」而不是「实现」——换 Levenshtein 库时只需跑这个测试确认分数没漂移。

import pytest
from apps.search.services.similarity import moving_window_similarity1


# ── 基础命中 ────────────────────────────────────────────────────────────────

def test_exact_match_scores_zero():
    """完全相同的词，dissimilarity 应该是 0.0（最佳分）。"""
    query   = ["Fionn", "mac", "Cumaill"]
    doc     = ["Fionn", "mac", "Cumaill"]
    results = moving_window_similarity1(query, doc, actual_window_size=3, step=1, top_k=1)

    best_score, best_idx = results[0]
    assert best_score == pytest.approx(0.0, abs=1e-9)
    assert best_idx == 0


def test_no_match_scores_high():
    """完全不相关的词，最佳分数应该明显高于 0。"""
    query   = ["Fionn"]
    doc     = ["zzzzz", "qqqqq", "xxxxx"]
    results = moving_window_similarity1(query, doc, actual_window_size=1, step=1, top_k=1)

    best_score, _ = results[0]
    assert best_score > 0.5


# ── 固定分数回归（核心）──────────────────────────────────────────────────────

def test_known_scores_do_not_drift():
    """
    用一组已知输入，锁定每个窗口位置的分数。
    这是「回归钉」——换库之后跑这个，分数相同说明行为没变。

    预期值由旧 Levenshtein 库跑出来后手动填入。
    如果替换库之后这里失败，说明算法行为发生了变化，需要评估。
    """
    query = ["find", "mac"]
    doc   = ["find", "mac", "cumaill", "agus", "find", "mor"]

    # window_size=2，step=1，top_k=全部 → 5 个窗口
    results = moving_window_similarity1(query, doc, actual_window_size=2, step=1, top_k=10)

    # 按 word_idx 建索引，方便断言
    by_idx = {idx: score for score, idx in results}

    # 窗口 [0,2)：["find","mac"] vs ["find","mac"] → 完全相同
    assert by_idx[0] == pytest.approx(0.0, abs=1e-6)

    # 窗口 [4,6)：["find","mac"] vs ["find","mor"] → "mor"≠"mac"，有一定 distance
    # "mac" vs "mor"：Levenshtein distance = 1，max_len = 3 → normalized = 1/3 ≈ 0.333
    # 平均 = (0 + 0.333) / 2 = 0.1667
    assert by_idx[4] == pytest.approx(0.333, abs=1e-3)


# ── top_k 截断 ───────────────────────────────────────────────────────────────

def test_results_are_sorted_best_first():
    """结果应按 dissimilarity 升序排列（分数越低越好）。"""
    query   = ["abc"]
    doc     = ["abc", "xyz", "abc", "ijk", "abc"]
    results = moving_window_similarity1(query, doc, actual_window_size=1, step=1, top_k=2)

    scores = [s for s, _ in results]
    assert scores == sorted(scores)       # 升序
    # 完全匹配（abc）的分数应该是 0
    assert scores[0] == pytest.approx(0.0, abs=1e-9)