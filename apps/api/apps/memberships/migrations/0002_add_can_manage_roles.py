# Generated manually for can_manage_roles

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('memberships', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='communitymember',
            name='can_manage_roles',
            field=models.BooleanField(
                default=False,
                help_text="Autorise ce membre à attribuer et modifier les rôles d'autres membres"
            ),
        ),
    ]
