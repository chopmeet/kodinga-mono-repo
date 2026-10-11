import json
from django.conf import settings
from django.core.management.base import BaseCommand
import resend
from common.services.email_service import EmailService, get_formatted_sender


class Command(BaseCommand):
    help = "Envoie un email de test via Resend et affiche la réponse complète en console."

    def add_arguments(self, parser):
        parser.add_argument(
            "recipient",
            type=str,
            help="Adresse email de destination pour le test",
        )
        parser.add_argument(
            "--subject",
            type=str,
            default="Test Resend Kodinga API",
            help="Sujet de l'email de test",
        )

    def handle(self, *args, **options):
        recipient = options["recipient"]
        subject = options["subject"]

        api_key = getattr(settings, "RESEND_API_KEY", "")
        sender = get_formatted_sender()

        self.stdout.write(self.style.NOTICE("\n=================================================="))
        self.stdout.write(self.style.NOTICE("🔍 [DIAGNOSTIC CONFIGURATION RESEND]"))
        self.stdout.write(f"  • RESEND_API_KEY : {'Défini (***' + api_key[-6:] + ')' if api_key else 'NON DÉFINI ❌'}")
        self.stdout.write(f"  • Expéditeur (From) : {sender}")
        self.stdout.write(f"  • Destinataire (To) : {recipient}")
        self.stdout.write(f"  • EMAIL_BACKEND     : {getattr(settings, 'EMAIL_BACKEND', '')}")
        self.stdout.write(self.style.NOTICE("==================================================\n"))

        if not api_key:
            self.stdout.write(self.style.ERROR("❌ Erreur : RESEND_API_KEY n'est pas renseigné dans votre .env !"))
            return

        self.stdout.write(self.style.NOTICE(f"📨 Envoi de l'email de test vers '{recipient}'..."))

        try:
            sent = EmailService.send_mail(
                to_email=recipient,
                subject=subject,
                template_name="welcome",
                context={"first_name": "Testeur", "username": "testeur"},
                fail_silently=False,
            )
            if sent:
                self.stdout.write(self.style.SUCCESS(f"\n🎉 Succès : L'email a bien été pris en charge par Resend !"))
            else:
                self.stdout.write(self.style.WARNING(f"\n⚠️ L'envoi a renvoyé False sans lever d'erreur explicite."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"\n❌ Échec lors de l'envoi : {exc}"))
            raise
