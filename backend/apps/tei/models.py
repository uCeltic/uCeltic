from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator
from django.utils.text import slugify


class Work(models.Model):
    """A named story, independent of the manuscript it survives in — the thing
    the workspace's opener groups its documents under (CONTEXT.md → Work).

    The relationship is stated here rather than parsed out of a document title:
    a title like "Laud Misc. 610 — Acallam na Senórach, ll. 2400–3106" happens
    to embed the work name, but the first document titled differently would
    silently fall out of its work (#152).
    """

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # An admin creating a work inline from the TEI upload form types a name
        # and nothing else; the slug is ours to derive.
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class TEIDocument(models.Model):
    title = models.CharField(max_length=500)
    # Nullable because documents predate works, and because the corpus holds
    # sample files (shakespear.xml, serafin*.xml) that belong to no work at all.
    # Losing a work must never take its documents with it, hence SET_NULL.
    work = models.ForeignKey(
        Work, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='documents',
    )
    language = models.CharField(max_length=50, blank=True)
    xml_file = models.FileField(upload_to='tei/', validators=[FileExtensionValidator(allowed_extensions=['xml','tei'])])
    parsed_json = models.JSONField(blank=True, null=True)
    meta = models.JSONField(blank=True, null=True)
    anchors = models.JSONField(blank=True, null=True)
    word_array = models.JSONField(blank=True, null=True)   
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']