"""Give every user a Profile the moment they sign up (#66)."""
from allauth.account.signals import user_signed_up
from django.dispatch import receiver

from .models import Profile


@receiver(user_signed_up)
def create_profile_on_signup(sender, request, user, **kwargs):
    Profile.objects.get_or_create(user=user)
