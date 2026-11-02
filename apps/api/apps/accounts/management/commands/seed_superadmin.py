from apps.accounts.models.user import User
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Seed superadmin user credentials for Django admin and platform management."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default="admin@admin.com",
            help="Superadmin email address (default: admin@admin.com)",
        )
        parser.add_argument(
            "--username",
            type=str,
            default="admin",
            help="Superadmin username handle (default: admin)",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="passer123",
            help="Superadmin password (default: passer123)",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        username = options["username"].strip().lower()
        password = options["password"]

        self.stdout.write(self.style.NOTICE(f"Seeding superadmin: {email}..."))

        user = User.objects.filter(email=email).first()
        if user:
            created = False
        else:
            created = True
            # Check if requested username is taken by another account
            if User.objects.filter(username=username).exists():
                if not User.objects.filter(username="superadmin").exists():
                    username = "superadmin"
                else:
                    username = f"admin_{email.split('@')[0]}"

            user = User(
                email=email,
                username=username,
                first_name="Super",
                last_name="Admin",
            )

        user.set_password(password)
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.is_superadmin = True
        if not user.email_verified_at:
            user.email_verified_at = timezone.now()
        user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully {action} Superadmin account!\n"
                f"  - Email       : {user.email}\n"
                f"  - Username    : {user.username}\n"
                f"  - Password    : {password}\n"
                f"  - is_staff    : {user.is_staff} (Django Admin Access)\n"
                f"  - is_superuser: {user.is_superuser} (Full Django Permissions)\n"
                f"  - is_superadmin: {user.is_superadmin} (Full API Admin Rights)\n"
                f"  - Admin URL   : http://localhost:8000/admin/\n"
                f"  - Swagger URL : http://localhost:8000/api/docs/\n"
            )
        )
