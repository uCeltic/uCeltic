"""One Search History entry, rendered as the Word document a reader keeps (#190).

The log rolls at 50 (ADR-0024), so this file is the only durable copy of a search — it
is laid out to be read, printed and cited, and it is built from the stored snapshot
alone, so it reproduces exactly what the entry holds and nothing that has happened to
the corpus since.
"""
import io

from django.utils import timezone
from docx import Document
from docx.shared import Pt

# The names the user tuned these by on the Advanced Search popover, not the wire names
# the model stores them under: someone reading the file months later recognises "Match
# Length", never `window_size_ratio`.
MATCH_LENGTH_LABEL = "Match Length"
PRECISION_LABEL = "Precision"
DISSIMILARITY_LABEL = "Dissimilarity Score"
TOP_K_LABEL = "Top K Results"


def match_percentage(score):
    """The stored dissimilarity as the similarity a reader understands (ADR-0024).

    Mirrors `client/src/history/matchPercentage.ts`, clamp included: the score has no
    upper bound in the store, and a matcher that one day returned more than 1 must not
    put a negative percentage in an exported document.
    """
    return f"{round(max(0.0, 1 - score) * 100)}%"


def _parameters(entry):
    """The four knobs on one line each, in the order the popover stacks them.

    `window_size_ratio` is converted back to the percentage the slider showed — 1.3 was
    130 on screen — and rounded, because the float that survives a round trip through
    JSON is 130.00000000000003.
    """
    return [
        f"{MATCH_LENGTH_LABEL}: {round(entry.window_size_ratio * 100)}%",
        f"{PRECISION_LABEL}: {entry.step_size}",
        f"{DISSIMILARITY_LABEL}: {entry.dissimilarity_threshold:.2f}",
        f"{TOP_K_LABEL}: {entry.top_k}",
    ]


def _when_searched(entry):
    """Written out in full rather than abbreviated: this is a citable date on a page that
    carries no other context about when it was made."""
    return timezone.localtime(entry.created_at).strftime("%d %B %Y at %H:%M")


def build_entry_document(entry):
    """The whole document for one entry: header, then each Version and its ranked hits."""
    document = Document()

    # The query is the title — it is what the reader is looking for when they open the
    # file, and quoted so a one-word search still reads as the thing that was searched.
    document.add_heading(f"Search: “{entry.query}”", level=0)
    document.add_paragraph(f"Searched {_when_searched(entry)}")
    for parameter in _parameters(entry):
        document.add_paragraph(parameter)

    covered = ", ".join(version.get("title", "") for version in entry.versions)
    document.add_paragraph(f"Versions searched: {covered}")

    for version in entry.versions:
        document.add_heading(version.get("title", ""), level=1)
        hits = version.get("hits", [])
        if not hits:
            # Kept, never dropped: a column that found nothing is part of what this
            # search was. A column that *errored* never reached the snapshot at all.
            document.add_paragraph("No matches.")
            continue
        for hit in hits:
            # No line number and no folio locator: a hit carries no usable line
            # reference for prose and no Manuscript Locator, so the passage and its
            # match percentage are the whole of what one hit can honestly say (#190).
            paragraph = document.add_paragraph(style="List Number")
            percentage = paragraph.add_run(f"{match_percentage(hit.get('score', 0))} match")
            percentage.bold = True
            paragraph.add_run(f" — {hit.get('snippet', '')}")

    for section in document.sections:
        section.left_margin = section.right_margin = Pt(72)

    return document


def entry_docx_bytes(entry):
    """The document as the bytes a response streams."""
    buffer = io.BytesIO()
    build_entry_document(entry).save(buffer)
    return buffer.getvalue()


def entry_filename(entry):
    """What the file lands in the reader's downloads as.

    Named for the moment searched rather than the query: a query can be any text at all
    — Old Irish, punctuation, an entire sentence — and the timestamp sorts a folder of
    exports into the order the searches were made. Seconds are included because two
    searches a minute apart is normal use.
    """
    stamped = timezone.localtime(entry.created_at).strftime("%Y-%m-%d-%H%M%S")
    return f"search-{stamped}.docx"
