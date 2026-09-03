from django.urls import path

from .views import SearchHistoryEntryView, SearchHistoryView

urlpatterns = [
    path("search-history/", SearchHistoryView.as_view()),
    # One entry, addressed by the `id` the read path hands back (#188). Its own view
    # rather than a query parameter on the collection: "delete this one" and "delete
    # them all" are different enough acts that they should not differ by a typo.
    path("search-history/<int:entry_id>/", SearchHistoryEntryView.as_view()),
]
