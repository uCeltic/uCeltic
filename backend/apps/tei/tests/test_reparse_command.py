"""`reparse_tei` brings documents parsed by an older parser up to date.

Parsing happens in a `post_save` signal, so a stored document keeps whatever the
parser produced on the day it was uploaded. Without this command a parser fix
(#142, #145, #151) is true only of the next upload — which is not what the
issues claim.
"""
import tempfile
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.tei.models import TEIDocument

STANDOFF_TEI = b"""<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <standOff>
    <listPerson>
      <person xml:id="fionn">
        <persName type="canonical">Find mac Cumaill</persName>
      </person>
    </listPerson>
  </standOff>
  <text><body>
    <l n="1">do chuaid <persName ref="#fionn">Find</persName></l>
  </body></text>
</TEI>"""


# An uploaded file is written to MEDIA_ROOT for real, so the test gets a
# throwaway one rather than leaving XML behind in the repo's media directory.
@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ReparseTEICommandTest(TestCase):
    def setUp(self):
        self.document = TEIDocument.objects.create(
            title="Acallam",
            xml_file=SimpleUploadedFile("acallam.xml", STANDOFF_TEI),
        )

    def test_it_replaces_an_index_built_by_an_older_parser(self):
        # what the pre-#151 parser left behind: the authority list in the index
        TEIDocument.objects.filter(pk=self.document.pk).update(
            word_array=[{"w": "Find", "a": 0, "sep": " "}, {"w": "mac", "a": 0, "sep": " "}],
        )

        call_command("reparse_tei", stdout=StringIO())

        self.document.refresh_from_db()
        self.assertEqual(
            [w["w"] for w in self.document.word_array],
            ["do", "chuaid", "Find"],
        )

    def test_it_reports_what_it_touched(self):
        out = StringIO()
        call_command("reparse_tei", stdout=out)

        self.assertIn("Re-parsed 1 document(s).", out.getvalue())
