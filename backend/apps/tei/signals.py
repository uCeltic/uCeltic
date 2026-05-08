import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import TEIDocument
from .services.parse import parse_tei
from .services.meta_extract import extract_meta
from .services.text_extract import extract_text_and_anchors

logger = logging.getLogger(__name__)
@receiver(post_save, sender=TEIDocument)
def parse_on_save(sender, instance, **kwargs):
    if not instance.xml_file:
        return
    
    try:
        with instance.xml_file.open('rb') as f:
            xml_bytes = f.read()
        tree = parse_tei(xml_bytes)
        meta = extract_meta(tree)
    except Exception as e:
        logger.error("TEI parse failed for %s: %s", instance.pk, e)
        return
    
    plain_text, anchors = extract_text_and_anchors(tree)
    TEIDocument.objects.filter(pk=instance.pk).update(
          parsed_json=tree, meta=meta,
          plain_text=plain_text, anchors=anchors,
      )
