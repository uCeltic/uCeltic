import Levenshtein
import sys
import json
import re





def tokenization_with_index(line):
    words = []
    indices = []
    for match in re.finditer(r'\b[a-zA-ZḟṡáéíóúÁÉÍÓÚ]+\b', line):
        words.append(match.group(0).lower()) 
        indices.append((match.start(), match.end())) 
    return words, indices



def moving_window_similarity1(target_words, total_words, actual_window_size, step=1, top_k=1):

    # make sure the window size is not larger than the total words
    if actual_window_size > len(total_words):
        actual_window_size = len(total_words)
        # print(f"Warning: Adjusted window size to {actual_window_size} (source text length)")
    
    # if there is no text to compare, return
    if len(total_words) == 0 or actual_window_size == 0:
        return [(0, 1.0)]  # return the index 0 and the max dissimilarity score 1.0
    
    # use the list to save the top-k results
    top_results = []
    
    # use the step to move the window
    for i in range(0, len(total_words)-actual_window_size+1, step):
        matrix = [[float("inf") for _ in range(actual_window_size)] for _ in range(len(target_words))]
        source_words = total_words[i:i+actual_window_size]
        for k in range(len(target_words)):
            for j in range(len(source_words)):
                score = Levenshtein.distance(target_words[k],source_words[j]) / max(len(target_words[k]), len(source_words[j]))

                matrix[k][j] = score



        # calculate the dissimilarity scores
        dissimilarity_scores = calculate_dissimilarity_score(matrix, actual_window_size)
        score = sum(dissimilarity_scores) / len(target_words)  # normalize the score to 0-1

        top_results.append((score, i))

    # sort the results
    return sorted(top_results)


def calculate_dissimilarity_score(matrix, actual_window_size):

    results = []

    for _ in range(len(matrix)):
        current_min_val = float("inf")
        min_row, min_col = -1,-1
        for r in range(len(matrix)):
            for c in range(actual_window_size):
                if matrix[r][c] < current_min_val:
                    current_min_val = matrix[r][c]
                    min_row = r
                    min_col = c
        
        if min_row == -1:
            break
        
        results.append(current_min_val)

        # set all the elements in the min_row to infinity
        for c in range(actual_window_size):
            matrix[min_row][c] = float('inf')
        
        # set all the elements in the min_col to infinity
        for r in range(len(matrix)):
            matrix[r][min_col] = float('inf')
    return results


def main():

    # Get parameters
    article = sys.argv[1]
    search_query = sys.argv[2]
    
    window_size = float(sys.argv[3])
    step_size = int(sys.argv[4])
    dissimilarity_threshold = float(sys.argv[5])
    top_k = int(sys.argv[6])

    target_words, _ = tokenization_with_index(search_query)
    article_tokens, token_indices = tokenization_with_index(article)

    actual_window_size = max(1, int(len(target_words) * window_size))

    if target_words == []:
        print(json.dumps([]))  
        return
    top_results = moving_window_similarity1(target_words, article_tokens, actual_window_size, step_size, top_k)
    
    # show the top-k results
    filtered_results = []
    for rank, (score, index) in enumerate(top_results[:top_k]):
        if score <= dissimilarity_threshold:
            if index + actual_window_size <= len(article_tokens):
                start_pos = token_indices[index][0]
                end_pos = token_indices[index+actual_window_size-1][1]
                text_snippet = article[start_pos:end_pos]
            else:
                start_pos = token_indices[index][0]
                text_snippet = article[start_pos:]
            filtered_results.append({
                    "text": ''.join(text_snippet),
                    "score": score
                })
    
    print(json.dumps(filtered_results))
            
if __name__ == "__main__":
    main()