"""Re-run the parser over every stored TEI document.

`parse_tei` runs from a `post_save` signal, so a document is parsed once, when
it is uploaded. Every later fix to the parser — the flat-stream tokeniser
(#145), comments and processing instructions (#142), the `standOff` skip (#151)
— therefore reaches new uploads only: rows already in the database keep the
`parsed_json`, `anchors` and `word_array` produced by the parser of the day.

This command re-saves each document so the signal parses it again. It is the
deploy step that makes a parser fix true of the corpus already on the server.
"""
from django.core.management.base import BaseCommand

from apps.tei.models import TEIDocument


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
                f"{len(document.word_array or [])} words"
            )

        self.stdout.write(self.style.SUCCESS(f"Re-parsed {reparsed} document(s)."))
