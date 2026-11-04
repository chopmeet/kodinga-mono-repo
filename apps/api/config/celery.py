import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('kodinga')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'send-upcoming-event-reminders-every-5-minutes': {
        'task': 'apps.events.tasks.send_event_reminders_task',
        'schedule': 300.0,  # Run every 5 minutes to catch events starting within 30 minutes
    },
    'expire-outdated-workspace-invitations-daily': {
        'task': 'apps.memberships.tasks.expire_outdated_invitations_task',
        'schedule': 86400.0,  # Run daily
    },
    'check-and-expire-subscriptions-hourly': {
        'task': 'apps.billing.tasks.check_and_expire_subscriptions',
        'schedule': 3600.0,  # Run hourly to expire ended subscriptions
    },
    'send-subscription-expiry-reminders-daily': {
        'task': 'apps.billing.tasks.send_subscription_expiry_reminders',
        'schedule': 86400.0,  # Run daily for 72h renewal reminders
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
