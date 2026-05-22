from apps.tei.models import TEIDocument
for doc in TEIDocument.objects.all():
    doc.save()


for d in TEIDocument.objects.all():
    print(d.pk, d.title, "words:", len(d.word_array or []))

doc = TEIDocument.objects.first()
print("anchors:", len(doc.anchors or []))
print("word_array:", len(doc.word_array or []))
print("first 5 words:", (doc.word_array or [])[:5])
print("first anchor:", (doc.anchors or [])[0] if doc.anchors else None)