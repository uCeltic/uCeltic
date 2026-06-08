from rapidfuzz.distance import Levenshtein
from collections import deque
# Use rapidfuzz instead of python-Levenshtein for faster computation.  
# rapidfuzz.distance.Levenshtein.normalized_distance(a, b) returns the normalized edit distance between a and b,
# is equivalent to the old method Levenshtein.distance(a, b) / max(len(a), len(b)), without manual division.

def moving_window_similarity1(target_words, total_words, actual_window_size, step=1,top_k=1, dissimilarity_threshold=float("inf")):
    if actual_window_size > len(total_words):
        actual_window_size = len(total_words)
    if len(total_words) == 0 or actual_window_size == 0:
        return [(0, 1.0)]
    Q = len(target_words)
    N = len(total_words)
    W = actual_window_size
    last_start = N - W  # starting index of the last window

    # (1) Precompute the Q x N normalized-distance matrix once, deduping
    #     identical doc words via a per-query-word cache. This removes the
    #     ~W-times redundant recompute caused by overlapping windows.
    #     D = [
    #     [0.0, 0.25, 0.8, ...],  # Edit distance between target_words[0] and total_words
    #     [0.5, 0.0, 0.7, ...],   # Edit distance between target_words[1] and total_words
    #     ...
    # ]
    
    D = []
    for k in range(Q):
        cache = {}
        qk = target_words[k]
        row = []
        for w in total_words:
            d = cache.get(w)
            if d is None:
                d = Levenshtein.normalized_distance(qk, w)
                cache[w] = d
            row.append(d)
        D.append(row)


    # (2) Per-row sliding-window minimum via a monotonic deque.
    #     row_min[k][i] = min(D[k][i .. i+W-1]) for each window start i.
    
    #     row_min = [
    #     [0.0, 0.0, 0.0],  # The minimum edit distance of target_words[0] in each window
    #     [0.0, 0.0, 0.0],  # The minimum edit distance of target_words[1] in each window
    # ]
    row_min = [[0.0] * (last_start + 1) for _ in range(Q)]
    for k in range(Q):
        dk = D[k]
        dq = deque()  # indices, values non-decreasing from the front
        for j in range(N):
            while dq and dk[dq[-1]] >= dk[j]:
                dq.pop()
            dq.append(j)
            # start is the index of the window/ or say "which window"
            start = j - W + 1
            if start >= 0:
                while dq[0] < start:
                    dq.popleft()
                # means the target_words[k] in the window "start" has the minimum edit distance "dk[dq[0]]"
                row_min[k][start] = dk[dq[0]]


    # (3) Per-window lower bound LB(i) = (sum_k row_min[k][i]) / Q. The greedy
    #     assignment picks distinct columns, so its score >= the sum of the
    #     per-row minima => LB is a provable lower bound. Run the (expensive)
    #     greedy only on windows whose LB <= threshold; subsample by `step`.
    best_i = None
    best_lb = float("inf")
    selected = []
    for i in range(0, last_start + 1, step):
        lb = 0.0
        for k in range(Q):
            lb += row_min[k][i]
        lb /= Q
        if lb < best_lb:
            best_lb = lb
            best_i = i
        if lb <= dissimilarity_threshold:
            selected.append(i)

    # Always keep the global-best window (smallest lower bound) as a fallback
    # so results[0] is never empty even when nothing passes the threshold.
    if not selected and best_i is not None:
        selected = [best_i]

    top_results = []
    for i in selected:
        # sub is the edit distance matrix of the target_words in the window "i", ready for "calculate_dissimilarity_score" matching
        sub = [[D[k][i + c] for c in range(W)] for k in range(Q)]
        dissimilarity_scores = calculate_dissimilarity_score(sub, W)
        score = sum(dissimilarity_scores) / Q
        top_results.append((score, i))
    return sorted(top_results)



def calculate_dissimilarity_score(matrix, actual_window_size):
    # greedy optimal pairing: find the global minimum value in each round, mark the row and column as used.
    results = []
    for _ in range(len(matrix)):
        current_min_val = float("inf")
        min_row, min_col = -1, -1
        for r in range(len(matrix)):
            for c in range(actual_window_size):
                if matrix[r][c] < current_min_val:
                    current_min_val = matrix[r][c]
                    min_row = r
                    min_col = c
        if min_row == -1:
            break
        results.append(current_min_val)

        # mark the row and column as used. It will not be used in the subsequent pairing.
        for c in range(actual_window_size):
            matrix[min_row][c] = float('inf')
        for r in range(len(matrix)):
            matrix[r][min_col] = float('inf')
    return results