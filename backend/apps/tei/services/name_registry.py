"""The corpus-wide register of the people and places the manuscripts name (#163).

`name_index` is one document's account of its own names; this is the register
every document contributes to. The split exists so a document can be
re-uploaded: its `name_index` is replaced wholesale on every parse, and the
register is folded back out of them all rather than incremented as files arrive,
so re-uploading the same manuscript three times changes nothing.

Two fields move on different clocks, and that is the whole design:

* `kind` follows the corpus. It is the majority `@type` over every occurrence in
  every document, so a later upload that tags `e6` `person` once cannot make a
  place into a man — but a corpus re-cut that fixes a real mistagging does show
  up.
* `headword` does not move at all. The first document to introduce a code sets
  it and nothing recomputes it, because a researcher who has learned to
  recognise *Find* must not find it renamed *Fionn* because a fifth manuscript
  was uploaded. A human edit is stronger still — it is marked `manual` and is
  never a candidate for rewriting even if that rule is ever relaxed.
"""
from collections import Counter, defaultdict

from django.db import transaction

from ..models import NameEntity, TEIDocument
from .name_index import headword_of, kind_of


@transaction.atomic
def register_names(name_index: dict[str, dict]) -> None:
    """Fold one freshly parsed document's `name_index` into the register.

    Call it only after the document's own `name_index` has been written, since
    the corpus-wide `@type` tally this reads back has to include it.

    Only the codes this document carries are touched. A code it does not mention
    cannot have changed by this upload, and is left exactly as it is — including
    a code no document mentions any more, which stays in the register and simply
    never reaches a menu, because the menu counts occurrences in the documents
    on screen and that one has none.
    """
    types = _corpus_type_tally()

    for code, entry in name_index.items():
        kind = kind_of(types.get(code, {}))
        entity = NameEntity.objects.filter(code=code).first()

        if entity is None:
            headword = headword_of(entry.get("variants", {}))
            # A group whose every occurrence is empty has nothing to print, so
            # it gets no row and no menu entry. Another document spelling it out
            # later is what creates it, and that document names it.
            if headword is None:
                continue
            NameEntity.objects.create(code=code, kind=kind, headword=headword)
            continue

        # `headword` is deliberately absent here: it belongs to whichever
        # document introduced the code, and an admin's edit outranks even that.
        if entity.kind != kind:
            entity.kind = kind
            entity.save(update_fields=["kind", "updated_at"])


def _corpus_type_tally() -> dict[str, Counter]:
    """How often each group was tagged `person` and `place`, over the whole corpus.

    Read back off every document rather than kept as a running total, because a
    running total cannot be corrected: re-parsing a document has to be able to
    take back what its previous parse contributed.
    """
    totals: dict[str, Counter] = defaultdict(Counter)
    indexes = TEIDocument.objects.exclude(name_index__isnull=True).values_list(
        "name_index", flat=True,
    )
    for index in indexes:
        for code, entry in (index or {}).items():
            totals[code].update(entry.get("types", {}))
    return totals
