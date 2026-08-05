from django.urls import path
from .views import NameEntityListView, TEIDocumentListView, TEIDocumentDetailView

urlpatterns = [
    path("", TEIDocumentListView.as_view()), #get all the TEI from the database
    # Before the `<int:pk>` route, or "names" would be matched as a document id.
    path("names/", NameEntityListView.as_view()), #the corpus-wide name register
    path("<int:pk>/", TEIDocumentDetailView.as_view()), #get a single TEI  from the database
]
