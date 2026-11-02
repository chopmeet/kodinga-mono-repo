from common.models.base import BaseModel
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.utils import timezone as django_timezone


class UserManager(BaseUserManager):
    """
    Custom user manager enforcing email-based authentication and lowercased unique usernames.
    """

    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field is required.")
        if not username:
            raise ValueError("The Username field is required.")

        email = self.normalize_email(email).lower()
        username = username.strip().lower()

        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)

        user = self.model(email=email, username=username, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_superadmin', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('email_verified_at', django_timezone.now())

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Custom User model for Kodinga platform.
    Primary authentication is done via email.
    """
    email = models.EmailField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="User's unique primary email address (case-insensitive)."
    )
    username = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique public handle/username (case-insensitive)."
    )
    first_name = models.CharField(
        max_length=150,
        blank=True,
        help_text="User's first name."
    )
    last_name = models.CharField(
        max_length=150,
        blank=True,
        help_text="User's last name."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Designates whether this user account is active."
    )
    is_staff = models.BooleanField(
        default=False,
        help_text="Designates whether the user can log into Django admin site."
    )
    is_superuser = models.BooleanField(
        default=False,
        help_text="Designates whether the user has all permissions without explicitly assigning them."
    )
    is_superadmin = models.BooleanField(
        default=False,
        help_text="Designates whether the user is a platform superadmin."
    )
    email_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the user verified their primary email."
    )
    preferred_language = models.CharField(
        max_length=10,
        default='fr',
        help_text="Preferred language code for emails and interface (e.g. 'fr', 'en')."
    )
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        help_text="User's primary timezone."
    )
    date_joined = models.DateTimeField(
        default=django_timezone.now,
        help_text="Timestamp when the user registered."
    )
    last_login = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of last successful login."
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['username']),
        ]

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.strip().lower()
        if self.username:
            self.username = self.username.strip().lower()
        if self.is_superadmin:
            self.is_staff = True
            self.is_superuser = True

    def save(self, *args, **kwargs):
        if self.is_superadmin:
            self.is_staff = True
            self.is_superuser = True
        self.clean()
        super().save(*args, **kwargs)

    def has_perm(self, perm, obj=None):
        if self.is_active and (self.is_superuser or self.is_superadmin):
            return True
        return super().has_perm(perm, obj)

    def has_perms(self, perm_list, obj=None):
        if self.is_active and (self.is_superuser or self.is_superadmin):
            return True
        return super().has_perms(perm_list, obj)

    def has_module_perms(self, app_label):
        if self.is_active and (self.is_superuser or self.is_superadmin):
            return True
        return super().has_module_perms(app_label)

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def is_pro(self) -> bool:
        """
        Returns True if user has an active platform Pro subscription or is a staff/superadmin.
        Hobby users return False.
        """
        if self.is_superuser or self.is_staff or self.is_superadmin:
            return True
        from apps.billing.models.subscription import Subscription, SubscriptionStatus
        return Subscription.objects.filter(
            user=self,
            community__isnull=True,
            status__in=[SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
            current_period_end__gt=django_timezone.now()
        ).exists()

    def mark_email_verified(self):
        self.email_verified_at = django_timezone.now()
        self.save(update_fields=['email_verified_at', 'updated_at'])

    def get_full_name(self) -> str:
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name if full_name else self.username

    def get_short_name(self) -> str:
        return self.first_name if self.first_name else self.username

    def __str__(self) -> str:
        return f"{self.username} ({self.email})"
