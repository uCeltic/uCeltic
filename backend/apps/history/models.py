from django.conf import settings
from django.db import models

# One entry is one user-initiated search, typed into the search bar or made from text
# selected in a viewer (ADR-0008). A Retry is neither: it repairs one column of a search
# that is already over, so it never reaches this table (ADR-0012).
QUERY_ORIGINS = [
    "typed",
    "selection",
]

# ADR-0024's rolling window. The 51st search drops the oldest, so the log stays a recent
# tail and Export is the only durable copy of a search.
MAX_ENTRIES_PER_USER = 50

# Length guards for the snapshot the client posts, sized well above what the workspace
# can actually produce: at most 8 columns are open at once (MAX_OPEN_DOCUMENTS) and a
# search returns at most top_k <= 100 hits per column. They exist for the same reason the
# Feedback field limits do (ADR-0014) - on a write endpoint, the bounds are the defense.
QUERY_MAX_LENGTH = 4000
TITLE_MAX_LENGTH = 500
SNIPPET_MAX_LENGTH = 2000
MAX_VERSIONS_PER_ENTRY = 8
MAX_HITS_PER_VERSION = 100


class SearchHistoryEntryManager(models.Manager):
    def capture(self, **fields):
        """Store one settled search and roll the user's log back down to the cap.

        The only way an entry is created. Trimming lives here rather than in the view
        because the cap is a property of the store, not of the HTTP path that happened
        to fill it — a future importer or admin action gets it for free.
        """
        entry = self.create(**fields)
        self._trim(entry.user_id)
        return entry

    def _trim(self, user_id):
        keep = self.filter(user_id=user_id).values_list("pk", flat=True)[
            :MAX_ENTRIES_PER_USER
        ]
        # Ordering is `-created_at, -pk` (see Meta), so `keep` is the most recent 50 and
        # everything else is older. Sliced querysets can't be filtered against directly,
        # hence the list().
        self.filter(user_id=user_id).exclude(pk__in=list(keep)).delete()


class SearchHistoryEntry(models.Model):
    """One whole search as the user experienced it, frozen at the moment it settled.

    Deliberately *not* a study model (ADR-0024): this is user-owned data the person who
    searched reads back from their own profile, where a BehaviorEvent is pseudonymized,
    researcher-only, and never shown to them. Its rows must stay out of the analysis
    cohort.

    Deliberately *not* a saved query either: it holds the results that came back then.
    Nothing here points at a TEI Document — the Version's title and every hit are plain
    text — so a Document later renamed or deleted leaves the entry whole.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="search_history",
    )
    query = models.TextField()
    query_origin = models.CharField(
        max_length=16, choices=[(o, o) for o in QUERY_ORIGINS]
    )
    # The four parameters the search ran with, under the names the search API uses, so a
    # stored entry and a logged `search_performed` describe the same knobs the same way.
    # "Match Length" is the UI's name for window_size_ratio (CONTEXT.md).
    window_size_ratio = models.FloatField()
    step_size = models.PositiveIntegerField()
    dissimilarity_threshold = models.FloatField()
    top_k = models.PositiveIntegerField()
    # `[{"title": str, "hits": [{"snippet": str, "score": float}]}]`, in the order the
    # columns sat on screen. One element per column that *returned*: a zero-hit column is
    # here with an empty `hits` (a search that found nothing is still a search), an
    # errored one is absent — its failure is an ErrorReport, not a second home in a
    # user-facing log (ADR-0013).
    versions = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    objects = SearchHistoryEntryManager()

    class Meta:
        # `-pk` breaks the tie that a burst of same-timestamp captures would otherwise
        # leave to the database, which is what makes "the oldest" well defined for the
        # cap above.
        ordering = ["-created_at", "-pk"]
        verbose_name_plural = "search history entries"

    def __str__(self):
        # Not the query: the admin renders this into the change page's <title> and
        # breadcrumb, and the query is text this user typed (#69's reasoning).
        return f"search @ {self.created_at:%Y-%m-%d %H:%M:%S}"
