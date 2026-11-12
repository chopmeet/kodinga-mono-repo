from decimal import Decimal
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0003_payment_payment_channel"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="communitypayout",
            name="fee_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="Frais de plateforme Kodinga (2%) sur le reversement",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="communitypayout",
            name="net_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                help_text="Montant net à décaisser vers le créateur",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="communitypayout",
            name="processed_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Administrateur ayant traité ou validé le virement",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="processed_payouts",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="communitypayout",
            name="admin_note",
            field=models.TextField(blank=True, help_text="Note administrative interne"),
        ),
        migrations.AlterField(
            model_name="communitypayout",
            name="amount",
            field=models.DecimalField(
                decimal_places=2,
                help_text="Montant brut demandé au reversement",
                max_digits=12,
            ),
        ),
        migrations.AlterField(
            model_name="communitypayout",
            name="payment_method",
            field=models.CharField(
                default="wave",
                help_text="wave, orange_money, bank_transfer, paydunya",
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name="communitypayout",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "En attente"),
                    ("approved", "Approuvé"),
                    ("processed", "Effectué"),
                    ("rejected", "Refusé"),
                    ("failed", "Échoué"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
    ]

