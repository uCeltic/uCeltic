from django.urls import path
from .views import TEIDocumentListView, TEIDocumentDetailView

urlpatterns = [
    path("", TEIDocumentListView.as_view()),
    path("<int:pk>/", TEIDocumentDetailView.as_view()),
]