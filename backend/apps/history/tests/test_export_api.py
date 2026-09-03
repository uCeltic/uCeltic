"""Exporting one Search History entry as a Word document (#190, ADR-0024)."""
import io

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from docx import Document

from apps.history.models import SearchHistoryEntry

SEARCH_HISTORY = "/api/search-history/"
DOCX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

User = get_user_model()


def _entry(user, **overrides):
    fields = {
        "user": user,
        "query": "ro gab in ri",
        "query_origin": "typed",
        "window_size_ratio": 1.3,
        "step_size": 2,
        "dissimilarity_threshold": 0.5,
        "top_k": 10,
        "versions": [
            {
                "title": "Lebor na hUidre",
                "hits": [
                    {"snippet": "ro gab in ri cetus", "score": 0.12},
                    {"snippet": "gabais in ri iarum", "score": 0.4},
                ],
            }
        ],
    }
    fields.update(overrides)
    return SearchHistoryEntry.objects.capture(**fields)


def _export(client, entry):
    return client.get(f"{SEARCH_HISTORY}{entry.pk}/export/")


def _paragraphs(response):
    document = Document(io.BytesIO(b"".join(response.streaming_content)))
    return [p.text for p in document.paragraphs]


class ExportOneEntryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner", email="owner@example.com", password="correct-horse-1"
        )
        self.client.force_login(self.user)

    def test_the_export_is_a_word_document_named_for_when_it_was_searched(self):
        entry = _entry(self.user)

        resp = _export(self.client, entry)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], DOCX_CONTENT_TYPE)
        stamped = timezone.localtime(entry.created_at).strftime("%Y-%m-%d-%H%M%S")
        self.assertEqual(
            resp["Content-Disposition"],
            f'attachment; filename="search-{stamped}.docx"',
        )

    def test_the_header_holds_the_query_the_time_and_the_four_parameters(self):
        entry = _entry(self.user)

        text = "\n".join(_paragraphs(_export(self.client, entry)))

        self.assertIn("ro gab in ri", text)
        self.assertIn(timezone.localtime(entry.created_at).strftime("%d %B %Y"), text)
        # The parameters under the names the user tuned them by, not the wire's:
        # window_size_ratio 1.3 is "130%" on the Match Length slider.
        self.assertIn("Match Length: 130%", text)
        self.assertIn("Precision: 2", text)
        self.assertIn("Dissimilarity Score: 0.50", text)
        self.assertIn("Top K Results: 10", text)

    def test_the_versions_the_search_covered_are_named(self):
        entry = _entry(
            self.user,
            versions=[
                {"title": "Lebor na hUidre", "hits": []},
                {"title": "Book of Leinster", "hits": []},
            ],
        )

        text = "\n".join(_paragraphs(_export(self.client, entry)))

        self.assertIn("Lebor na hUidre", text)
        self.assertIn("Book of Leinster", text)

    def test_each_hit_is_its_match_percentage_and_the_passage_and_nothing_else(self):
        entry = _entry(self.user)

        paragraphs = _paragraphs(_export(self.client, entry))

        # `(1 − score) × 100 %`, and the hits in the order the search ranked them. The
        # whole paragraph is asserted, not a substring: a line number or a folio locator
        # creeping in later fails here (#190).
        self.assertIn("88% match — ro gab in ri cetus", paragraphs)
        self.assertIn("60% match — gabais in ri iarum", paragraphs)
        self.assertLess(
            paragraphs.index("88% match — ro gab in ri cetus"),
            paragraphs.index("60% match — gabais in ri iarum"),
        )

    def test_a_score_above_one_never_reads_as_a_negative_match(self):
        entry = _entry(
            self.user,
            versions=[{"title": "Lebor na hUidre", "hits": [{"snippet": "x", "score": 1.4}]}],
        )

        self.assertIn("0% match — x", _paragraphs(_export(self.client, entry)))

    def test_a_version_that_found_nothing_says_so(self):
        entry = _entry(self.user, versions=[{"title": "Lebor na hUidre", "hits": []}])

        self.assertIn("No matches.", _paragraphs(_export(self.client, entry)))


class ExportOwnershipTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner", email="owner@example.com", password="correct-horse-1"
        )

    def test_another_users_entry_is_not_exportable(self):
        entry = _entry(self.user)
        stranger = User.objects.create_user(
            username="stranger", email="stranger@example.com", password="correct-horse-2"
        )
        self.client.force_login(stranger)

        self.assertEqual(_export(self.client, entry).status_code, 404)

    def test_an_id_that_never_existed_is_a_404(self):
        self.client.force_login(self.user)

        resp = self.client.get(f"{SEARCH_HISTORY}9999/export/")

        self.assertEqual(resp.status_code, 404)

    def test_an_anonymous_visitor_cannot_export(self):
        entry = _entry(self.user)

        self.assertEqual(_export(self.client, entry).status_code, 403)
