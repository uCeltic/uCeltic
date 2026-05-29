from rapidfuzz.distance import Levenshtein

# Use rapidfuzz instead of python-Levenshtein for faster computation.  
# rapidfuzz.distance.Levenshtein.normalized_distance(a, b) returns the normalized edit distance between a and b,
# is equivalent to the old method Levenshtein.distance(a, b) / max(len(a), len(b)), without manual division.

def moving_window_similarity1(target_words, total_words, actual_window_size, step=1,top_k=1):
    if actual_window_size > len(total_words):
        actual_window_size = len(total_words)
    if len(total_words) == 0 or actual_window_size == 0:
        return [(0, 1.0)]
    top_results = []
    for i in range(0, len(total_words) - actual_window_size + 1, step):
        matrix = [[float("inf") for _ in range(actual_window_size)] for _ in range(len(target_words))]
        source_words = total_words[i:i + actual_window_size]
        for k in range(len(target_words)):
            for j in range(len(source_words)):
                matrix[k][j] = Levenshtein.normalized_distance(target_words[k], source_words[j])
                  
        dissimilarity_scores = calculate_dissimilarity_score(matrix, actual_window_size)
        score = sum(dissimilarity_scores) / len(target_words)
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