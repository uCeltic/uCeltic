from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf, name="csrf"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path(
        "resend-verification-email/",
        views.resend_verification_email,
        name="resend_verification_email",
    ),
]
