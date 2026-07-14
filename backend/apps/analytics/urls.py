from django.urls import path
from .views import EventView, QuestionnaireView

urlpatterns = [
    path('events/', EventView.as_view()),
    path('questionnaire/', QuestionnaireView.as_view()),
]