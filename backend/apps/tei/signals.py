#listener for when a TEI document is saved, it will parse the document and extract the metadata and text. 
#Then update the TEIDocument object with the parsed data.
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import TEIDocument
from .services.parse import parse_tei
from .services.meta_extract import extract_meta
from .services.name_index import build_name_index
from .services.name_registry import register_names

logger = logging.getLogger(__name__)

# listener for when a TEI document is saved, it will parse the document and extract the metadata and text.
# Then update the TEIDocument object with the parsed data.
@receiver(post_save, sender=TEIDocument)
def parse_on_save(sender, instance, **kwargs):

    if not instance.xml_file:
        return
    # parse tei, extract the metadata and text, and update the TEIDocument object with parsed_json, anchors and word array
    try:
        with instance.xml_file.open('rb') as f:
            xml_bytes = f.read()
        tree, anchors, word_array = parse_tei(xml_bytes)
        meta = extract_meta(tree)
        name_index = build_name_index(xml_bytes)
    except Exception as e:
        logger.error("TEI parse failed for %s: %s", instance.pk, e)
        return

    # update the database
    TEIDocument.objects.filter(pk=instance.pk).update(
        parsed_json=tree,
        meta=meta,
        anchors=anchors,
        word_array=word_array,
        name_index=name_index,
    )

    # After the write, never before: the register is folded back out of every
    # stored `name_index`, so this document's own has to be in the database for
    # its names to count toward the corpus-wide answer (#163).
    #
    # Guarded like the parse above, and for the same reason: a document whose
    # text parsed is worth keeping even if the register could not be updated
    # from it. What is lost is menu rows, which the next `reparse_tei` restores.
    try:
        register_names(name_index)
    except Exception as e:
        logger.error("Name registry update failed for %s: %s", instance.pk, e)
