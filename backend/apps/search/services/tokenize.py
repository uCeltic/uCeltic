import re


def tokenization_with_index(text: str, irish: bool = False) -> tuple[list[str], list[tuple[int, int]]]:
    words = []
    indices = []
    for match in re.finditer(r'\b[a-zA-ZḟṡáéíóúÁÉÍÓÚ]+\b', text):
        word = match.group(0).lower()
        words.append(word)
        indices.append((match.start(), match.end()))
    return words, indices