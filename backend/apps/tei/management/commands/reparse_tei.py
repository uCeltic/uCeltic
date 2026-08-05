"""Re-run the parser over every stored TEI document.

`parse_tei` runs from a `post_save` signal, so a document is parsed once, when
it is uploaded. Every later fix to the parser — the flat-stream tokeniser
(#145), comments and processing instructions (#142), the `standOff` skip (#151)
— therefore reaches new uploads only: rows already in the database keep the
`parsed_json`, `anchors` and `word_array` produced by the parser of the day.

This command re-saves each document so the signal parses it again. It is the
deploy step that makes a parser fix true of the corpus already on the server.

It is also how a document uploaded before the name registry existed (#163) gets
one: its `name_index` is null until it is parsed again, and the corpus-wide
register is folded back out of those indexes, so until every document has been
through here the Tag Filter is a menu of only part of the corpus.
"""
from django.core.management.base import BaseCommand

from apps.tei.models import NameEntity, TEIDocument


class Command(BaseCommand):
    help = "Re-parse every stored TEI document with the current parser."

    def handle(self, *args, **options):
        documents = TEIDocument.objects.all().order_by("pk")
        reparsed = 0

        for document in documents:
            # The signal reports its own failures and leaves the old parse in
            # place, so one unparsable file cannot stop the rest of the corpus
            # from being brought up to date.
            document.save()
            document.refresh_from_db()
            reparsed += 1
            self.stdout.write(
                f"{document.pk} {document.title}: "
                f"{len(document.word_array or [])} words, "
                f"{len(document.name_index or {})} named entities"
            )

        self.stdout.write(self.style.SUCCESS(f"Re-parsed {reparsed} document(s)."))
        self.stdout.write(
            f"Register now holds {NameEntity.objects.count()} name entities."
        )
