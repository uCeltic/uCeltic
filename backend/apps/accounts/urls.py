from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf, name="csrf"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
]
