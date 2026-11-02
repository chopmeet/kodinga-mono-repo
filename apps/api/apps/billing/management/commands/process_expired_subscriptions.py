from apps.billing.tasks import check_and_expire_subscriptions
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Expire past-due subscriptions and revoke community access for unpaid members."

    def handle(self, *args, **options):
        self.stdout.write("Checking and processing expired subscriptions...")
        res = check_and_expire_subscriptions()
        self.stdout.write(
            self.style.SUCCESS(
                f"Done: {res['expired_subscriptions']} subscriptions marked expired, "
                f"{res['suspended_memberships']} community memberships suspended."
            )
        )
