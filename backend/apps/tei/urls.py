from django.urls import path
from .views import TEIDocumentListView, TEIDocumentDetailView

urlpatterns = [
    path("", TEIDocumentListView.as_view()), #get all the TEI from the database
    path("<int:pk>/", TEIDocumentDetailView.as_view()), #get a single TEI  from the database
]