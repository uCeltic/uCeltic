from django.urls import path
from .views import EventView, FeedbackView, QuestionnaireView

urlpatterns = [
    path('events/', EventView.as_view()),
    path('questionnaire/', QuestionnaireView.as_view()),
    path('feedback/', FeedbackView.as_view()),
]