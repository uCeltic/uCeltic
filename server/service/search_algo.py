import Levenshtein
import sys
import json
import re

# removing punctuations and numbers
sym_and_num = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]


INITAL_MUTATIONS = {
    #nasalisation
    'ng': 'g', 'mb': 'b', 'nd': 'd',
    'na': 'a', 'ne': 'e', 'ni': 'i', 'no': 'o', 'nu': 'u',
    #lenition
    'ch': 'c', 'ph': 'p', 'th': 't', 
    'ḟ': 'f', 'fh': 'f', 'ṡ': 's', 'sh': 's',
    #gemination
    'll': 'l', 'nn': 'n', 'rr': 'r', 'mm': 'm', 'ss': 's',
}



def tokenization(line):
    total_words = []
    for w in line:
        if w in sym_and_num:
            line = line.replace(w, "")
    if line.endswith('.'):
        line = line[:-1]
    line = line.lower()
    words = line.split()
    total_words += words
    return total_words

def tokenization_irish(line):
    total_words = []
    for w in line: 
        if w in sym_and_num:
            line = line.replace(w, "")
    if line.endswith('.'):
        line = line[:-1]
    line = line.lower()
    words = line.split()
    for word in words:
        if word[0] == 'ḟ':  
            word = 'f' + word[1:]
        if word[0] == 'ṡ':
            word = 's'+ word[1:]
        if len(word) >= 2:  
            replacement = INITAL_MUTATIONS.get(word[:2],'')
            if replacement:
                word = replacement+word[2:] 

        total_words.append(word)

    return total_words


def tokenization_with_index(line):
    words = []
    indices = []
    for match in re.finditer(r'\b\w+\b', line):
        words.append(match.group(0).lower()) 
        indices.append((match.start(), match.end())) 
    return words, indices



def moving_window_similarity1(target_words, total_words, actual_window_size, step=1, top_k=1):

    # 确保窗口大小不超过源文本长度
    if actual_window_size > len(total_words):
        actual_window_size = len(total_words)
        # print(f"Warning: Adjusted window size to {actual_window_size} (source text length)")
    
    # 如果没有足够的文本进行比较，返回特殊值
    if len(total_words) == 0 or actual_window_size == 0:
        return [(0, 1.0)]  # 返回索引0和最大不相似度1.0
    
    # 使用最大堆来保存top-k结果（python的heapq是最小堆，所以存储负分数来实现最大堆）
    top_results = []
    
    # 使用步长step移动窗口
    for i in range(0, len(total_words)-actual_window_size+1, step):
        matrix = [[float("inf") for _ in range(actual_window_size)] for _ in range(len(target_words))]
        source_words = total_words[i:i+actual_window_size]
        for k in range(len(target_words)):
            for j in range(len(source_words)):
                score = Levenshtein.distance(target_words[k],source_words[j]) / max(len(target_words[k]), len(source_words[j]))

                matrix[k][j] = score



        # 接下来计算每个矩阵中的分数
        dissimilarity_scores = calculate_dissimilarity_score(matrix, actual_window_size)
        score = sum(dissimilarity_scores) / len(target_words)  # 归一化到0-1之间

        top_results.append((score, i))

    # 排序结果，保证按分数从小到大返回
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

        # 修正：将所有在min_row行的元素设为无穷大
        for c in range(actual_window_size):
            matrix[min_row][c] = float('inf')
        
        # 修正：将所有在min_col列的元素设为无穷大
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
    irish_algo = int(sys.argv[7])

    if irish_algo:
        target_words = tokenization_irish(search_query)
    else:
        target_words = tokenization(search_query)
    article_tokens, token_indices = tokenization_with_index(article)

    actual_window_size = max(1, int(len(target_words) * window_size))

    if target_words == []:
        print(json.dumps([]))  
        return
    top_results = moving_window_similarity1(target_words, article_tokens, actual_window_size, step_size, top_k)
    
    # 显示top-k结果
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