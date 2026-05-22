from apps.search.services.run_search import run_search
from apps.tei.models import TEIDocument

for d in TEIDocument.objects.all():
    print(d.pk, repr(d.title), "words:", len(d.word_array or []))

print("\n--- doc 8 / 'Find mac Cumaill' ---")
results = run_search(8, "Find mac Cumaill", top_k=3, dissimilarity_threshold=1.0)
for r in results:
    print(f"score={r['score']:.3f}  word=[{r['word_start']},{r['word_end']})  "
        f"anchor={r['anchor_id']}({r['anchor_tag']})  line={r['line_no']}")
    print(f"  snippet: {r['snippet']!r}")

print("\n--- doc 2 / Shakespeare 'to be or not to be' ---")
results = run_search(2, "to be or not to be", top_k=3, dissimilarity_threshold=1.0)
for r in results:
    print(f"score={r['score']:.3f}  word=[{r['word_start']},{r['word_end']})  "
        f"anchor={r['anchor_id']}({r['anchor_tag']})  line={r['line_no']}")
    print(f"  snippet: {r['snippet']!r}")