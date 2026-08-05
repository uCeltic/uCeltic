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
    # This document's own account of the names it marks up, keyed by the
    # `@nymRef` group id: `{"F64": {"count": 21, "types": {...},
    # "variants": {...}, "anchors": [...]}}` (#163). Written at parse time and
    # replaced wholesale on every re-parse, so a document can be re-uploaded
    # without double-counting — which is why the corpus-wide `NameEntity`
    # register is aggregated from these rather than incremented as files arrive.
    name_index = models.JSONField(blank=True, null=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']


class NameEntity(models.Model):
    """One person or place the corpus names, as the corpus groups them (#163).

    The group itself is the corpus's claim, stated with a bare `@nymRef` id on
    every occurrence: `Find`, `Fionn`, `Find` and `Finn` are one man because the
    four witnesses all write `nymRef="F64"`, not because anything here compared
    the spellings. What no file carries is a NAME for the group — `F64` appears
    64 times and no document ever says who `F64` is — and that is the one thing
    this table adds.

    Aggregated from every document's `name_index` after each parse, so
    re-uploading a document cannot double-count it.
    """

    DERIVED = 'derived'
    MANUAL = 'manual'
    HEADWORD_SOURCES = [
        (DERIVED, 'Derived from the corpus'),
        (MANUAL, 'Set by hand'),
    ]

    PERSON = 'person'
    PLACE = 'place'
    KINDS = [(PERSON, 'Person'), (PLACE, 'Place')]

    # The `@nymRef` value verbatim, case and all. The annotators' own name lists
    # tell people from places by case — `A13` is Aed mac Echach Lethdeirg, `a13`
    # is Almu, and 483 codes collide that way — so folding case would silently
    # make one entity of a man and a hillfort. Postgres compares this column
    # case-sensitively, which is what keeps the two rows apart.
    code = models.CharField(max_length=64, unique=True)
    # The majority `@type` over every occurrence in the corpus, recomputed as
    # documents arrive: `e6` is tagged `place` 113 times and `person` once, and
    # it is a place.
    kind = models.CharField(max_length=16, choices=KINDS)
    # What the Tag Filter prints. Fixed by the first document to introduce the
    # code and never recomputed: uploading more manuscripts later must not
    # rename an entity a researcher has already learned to recognise.
    headword = models.CharField(max_length=255)
    # `manual` marks a headword a human chose, which no upload may overwrite.
    # This is also where the team's own person_name_list.csv / place_name_list.csv
    # will land if they are ever wired in — a second source for the same field,
    # changing nothing else.
    headword_source = models.CharField(
        max_length=16, choices=HEADWORD_SOURCES, default=DERIVED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.headword} ({self.code})'

    class Meta:
        verbose_name_plural = 'name entities'
        ordering = ['headword']