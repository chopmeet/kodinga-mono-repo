import logging

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.profiles.models.profile import DeveloperProfile

logger = logging.getLogger('kodinga.profiles')


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_developer_profile_signal(sender, instance, created, **kwargs):
    """
    Ensure each User has an associated DeveloperProfile created automatically.
    """
    if created:
        try:
            DeveloperProfile.objects.get_or_create(user=instance)
        except Exception as exc:
            logger.error(f"Error auto-creating DeveloperProfile for User {instance.id}: {exc}")
