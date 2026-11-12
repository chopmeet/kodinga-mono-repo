from django.core.management.base import BaseCommand

from apps.ai.models.documentation import (
    DocumentationCategory,
    PlatformDocumentation,
)

OFFICIAL_KODINGA_DOCS = [
    {
        "slug": "presentation-generale-kodinga",
        "title": "Présentation générale de la plateforme Kodinga",
        "category": DocumentationCategory.GENERAL,
        "version": "1.2.0",
        "is_active": True,
        "summary": "Kodinga est la plateforme communautaire tech, d'apprentissage collaboratif et d'innovation dédiée aux développeurs, créateurs et mentors en Afrique et dans le monde.",
        "keywords": [
            "kodinga",
            "plateforme",
            "présentation",
            "qu'est-ce que",
            "à quoi sert",
            "mission",
            "afrique",
            "tech",
        ],
        "content": (
            "# Présentation de Kodinga\n\n"
            "Kodinga est une plateforme communautaire et éducative tout-en-un conçue pour rassembler les développeurs, "
            "les apprenants, les formateurs et les entrepreneurs technologiques.\n\n"
            "## Objectifs principaux :\n"
            "- **Créer et rejoindre des communautés thématiques** (Développement Web, IA, Data Science, Mobile, Cloud, Cybersécurité, Design).\n"
            "- **Apprendre via le Classroom** : suivre des parcours structurés en cours, modules et leçons interactives avec quiz et exercices de code.\n"
            "- **Collaborer sur des projets et hackathons** : soumettre des projets, former des équipes et participer à des compétitions tech.\n"
            "- **Échanger en temps réel** : discussions, entraide technique, événements live et messagerie directe.\n"
            "- **Monétiser son expertise** : les créateurs peuvent proposer des communautés gratuites ou payantes (via Mobile Money et carte bancaire avec PayDunya)."
        ),
        "metadata": {"route": "/explore"},
    },
    {
        "slug": "creation-et-gestion-communaute",
        "title": "Comment créer et gérer une communauté sur Kodinga",
        "category": DocumentationCategory.COMMUNITIES,
        "version": "1.3.0",
        "is_active": True,
        "summary": "Procédure complète étape par étape pour créer, configurer, animer et modérer une communauté sur Kodinga.",
        "keywords": [
            "créer",
            "création",
            "communauté",
            "lancer",
            "gérer",
            "configurer",
            "publique",
            "privée",
            "secrète",
            "paramètres",
        ],
        "content": (
            "# Créer et gérer une communauté sur Kodinga\n\n"
            "## 1. Procédure de création d'une communauté\n"
            "1. Connectez-vous à votre compte Kodinga.\n"
            "2. Cliquez sur le bouton **« Créer une communauté »** depuis la barre latérale ou le tableau de bord (`/communities/create`).\n"
            "3. Renseignez les informations essentielles :\n"
            "   - **Nom de la communauté** (unique et explicite).\n"
            "   - **Accroche (Tagline)** et **Description détaillée** (supporte le format Markdown).\n"
            "   - **Catégorie** (ex: IA & Data, Web, DevOps, Mobile).\n"
            "   - **Visibilité (`privacy_type`)** :\n"
            "     - `public` : visible par tous, adhésion directe.\n"
            "     - `private` : visible dans l'annuaire, adhésion sur demande ou abonnement.\n"
            "     - `secret` : masquée de l'annuaire public, accessible uniquement sur invitation.\n"
            "   - **Modèle d'accès (`pricing_type`)** :\n"
            "     - `free` : communauté gratuite.\n"
            "     - `paid` : communauté payante avec abonnement (note : toute communauté payante passe automatiquement en visibilité `private`).\n"
            "4. Personnalisez l'identité visuelle (avatar, bannière, couleur de marque) et validez.\n\n"
            "## 2. Gestion et animation au quotidien\n"
            "- **Canaux et catégories de posts** : structurez les discussions (`#annonces`, `#entraide`, `#projets`).\n"
            "- **Classroom** : ajoutez des cours, modules et leçons pour former vos membres.\n"
            "- **Événements** : planifiez des ateliers en ligne ou en présentiel.\n"
            "- **Tableau de bord analytique** : suivez la croissance des membres, l'engagement et la rétention."
        ),
        "metadata": {"route": "/communities/create"},
    },
    {
        "slug": "fonctionnalites-plateforme",
        "title": "Catalogue des fonctionnalités officielles de Kodinga",
        "category": DocumentationCategory.FEATURES,
        "version": "1.2.0",
        "is_active": True,
        "summary": "Détail des fonctionnalités disponibles sur Kodinga : Discussions, Classroom, Hackathons, Vitrine de Projets, Opportunités, Gamification et Messagerie.",
        "keywords": [
            "fonctionnalités",
            "features",
            "classroom",
            "cours",
            "hackathon",
            "projets",
            "opportunités",
            "gamification",
            "badges",
            "points",
            "xp",
            "messagerie",
            "événements",
        ],
        "content": (
            "# Fonctionnalités Officielles de Kodinga\n\n"
            "1. **Espaces Communautaires & Discussions (`Posts`)** :\n"
            "   - Publications enrichies en Markdown, questions techniques, sondages, annonces officielles et vitrines de projets.\n"
            "   - Détection automatique des questions en doublon et recherche sémantique.\n"
            "2. **Classroom & Formations (`Courses`, `Modules`, `Lessons`)** :\n"
            "   - Cours structurés en modules et leçons (vidéo, texte Markdown, quiz générés, exercices de code).\n"
            "   - Suivi de progression individuel.\n"
            "3. **Hackathons & Compétitions (`Hackathons`)** :\n"
            "   - Inscription individuelle ou en équipe, soumission de projets, critères d'évaluation et classement.\n"
            "4. **Vitrine de Projets (`Projects`)** :\n"
            "   - Publication de projets tech avec liens GitHub/Démo, votes de la communauté et commentaires.\n"
            "5. **Opportunités (`Opportunities`)** :\n"
            "   - Offres d'emploi, stages, missions freelance et bourses partagés au sein de l'écosystème.\n"
            "6. **Gamification & Récompenses (`Gamification`)** :\n"
            "   - Gain de points XP, niveaux, séries d'activité (streaks), badges et classements (leaderboards).\n"
            "7. **Événements (`Events`)** :\n"
            "   - Webinaires, ateliers live, gestion des inscriptions (RSVP) et rediffusions.\n"
            "8. **Traduction Multilingue & Langues Locales** :\n"
            "   - Support du Français (`fr`), de l'Anglais (`en`), du Wolof (`wo`) et du Bambara (`bm`)."
        ),
        "metadata": {"route": "/explore"},
    },
    {
        "slug": "roles-permissions-et-confidentialite",
        "title": "Rôles, permissions et niveaux d'accès dans les communautés",
        "category": DocumentationCategory.ROLES_PERMISSIONS,
        "version": "1.1.0",
        "is_active": True,
        "summary": "Explication des rôles (Propriétaire, Administrateur, Modérateur, Membre) et des règles de confidentialité des communautés sur Kodinga.",
        "keywords": [
            "rôle",
            "rôles",
            "permission",
            "permissions",
            "propriétaire",
            "owner",
            "admin",
            "administrateur",
            "modérateur",
            "membre",
            "accès",
            "privé",
            "confidentialité",
        ],
        "content": (
            "# Rôles et Permissions sur Kodinga\n\n"
            "## 1. Rôles au sein d'une communauté\n"
            "- **Propriétaire (`owner`)** : Créateur de la communauté. Dispose de tous les droits (configuration, facturation, nomination d'admins, suppression).\n"
            "- **Administrateur (`admin`)** : Gère les paramètres de la communauté, les cours du Classroom, les événements et la modération des membres.\n"
            "- **Modérateur (`moderator`)** : Modère les publications et commentaires, épingle les posts et veille au respect des règles.\n"
            "- **Membre (`member`)** : Participe aux discussions, accède aux cours et événements réservés aux membres de la communauté.\n\n"
            "## 2. Règles de confidentialité et d'accès aux contenus\n"
            "- **Communauté Publique (`public`)** : Les informations de présentation et les publications publiques sont consultables. L'adhésion est immédiate.\n"
            "- **Communauté Privée (`private`)** : La fiche de présentation (nom, description, nombre de membres) est visible dans l'annuaire, mais **les cours, modules, leçons, discussions internes et ressources privées sont strictement réservés aux membres actifs (`status = active`)**.\n"
            "- **Communauté Secrète (`secret`)** : Invisible dans les recherches publiques et accessible uniquement aux membres invités."
        ),
        "metadata": {},
    },
    {
        "slug": "abonnements-offres-et-paiements",
        "title": "Abonnements, tarifs et moyens de paiement sur Kodinga",
        "category": DocumentationCategory.BILLING,
        "version": "1.2.0",
        "is_active": True,
        "summary": "Fonctionnement des abonnements aux communautés payantes, plans tarifaires, facturation et paiements Mobile Money / Carte via PayDunya.",
        "keywords": [
            "abonnement",
            "abonnements",
            "paiement",
            "payer",
            "tarif",
            "prix",
            "offre",
            "paydunya",
            "wave",
            "orange money",
            "free money",
            "carte bancaire",
            "facture",
            "gratuit",
            "payant",
        ],
        "content": (
            "# Abonnements et Paiements sur Kodinga\n\n"
            "## 1. Communautés Gratuites vs Payantes\n"
            "- **Communautés Gratuites (`free`)** : Accès sans frais d'adhésion.\n"
            "- **Communautés Payantes (`paid`)** : Nécessitent la souscription à un plan d'abonnement défini par le propriétaire de la communauté (mensuel, annuel ou accès à vie).\n\n"
            "## 2. Moyens de paiement supportés\n"
            "Les paiements sont sécurisés via la passerelle **PayDunya** et prennent en charge :\n"
            "- **Wave** (Sénégal, Côte d'Ivoire)\n"
            "- **Orange Money** (Sénégal, Côte d'Ivoire, Mali, Burkina Faso)\n"
            "- **Free Money / T-Money / Moov Money / MTN Mobile Money**\n"
            "- **Cartes bancaires (Visa / Mastercard)**\n\n"
            "## 3. Gestion de vos abonnements\n"
            "- Consultez vos abonnements actifs et votre historique de facturation dans **Tableau de bord > Facturation (`/dashboard/billing`)**.\n"
            "- Dès que le paiement est confirmé (`PAID`), votre accès membre à la communauté est activé automatiquement."
        ),
        "metadata": {"route": "/dashboard/billing"},
    },
    {
        "slug": "compte-profil-et-securite",
        "title": "Gestion du compte utilisateur, authentification et profil développeur",
        "category": DocumentationCategory.USER_GUIDE,
        "version": "1.1.0",
        "is_active": True,
        "summary": "Inscription, connexion OAuth (Google, GitHub), personnalisation du profil développeur, gestion des sessions et sécurité du compte.",
        "keywords": [
            "compte",
            "profil",
            "connexion",
            "inscription",
            "mot de passe",
            "oauth",
            "github",
            "google",
            "sécurité",
            "session",
            "paramètres",
            "langue",
        ],
        "content": (
            "# Gestion du Compte et du Profil sur Kodinga\n\n"
            "## 1. Authentification\n"
            "- **Email et mot de passe** : inscription avec vérification d'adresse email.\n"
            "- **Connexion sociale (OAuth 2.0)** : connexion rapide avec **Google** ou **GitHub**.\n\n"
            "## 2. Profil Développeur\n"
            "- Renseignez votre bio, vos compétences techniques (skills), votre portfolio, vos liens GitHub/LinkedIn et votre langue préférée (`fr`, `en`, `wo`, `bm`).\n\n"
            "## 3. Sécurité et Sessions\n"
            "- Gérez vos sessions actives et révoquez à distance tout appareil suspect depuis les paramètres de sécurité.\n"
            "- Réinitialisez votre mot de passe à tout moment via la procédure « Mot de passe oublié »."
        ),
        "metadata": {"route": "/dashboard/settings"},
    },
    {
        "slug": "regles-de-fonctionnement-et-charte",
        "title": "Règles de fonctionnement, modération et charte communautaire",
        "category": DocumentationCategory.RULES,
        "version": "1.0.0",
        "is_active": True,
        "summary": "Charte de bonne conduite, modération bienveillante et règles de sécurité sur la plateforme Kodinga.",
        "keywords": [
            "règles",
            "charte",
            "modération",
            "comportement",
            "respect",
            "interdit",
            "signalement",
            "politique",
        ],
        "content": (
            "# Règles de fonctionnement et Charte Kodinga\n\n"
            "- **Bienveillance et respect** : Le harcèlement, les propos haineux, les menaces et les insultes sont strictement interdits et bloqués par notre système de modération.\n"
            "- **Pertinence des échanges** : Publiez dans les canaux appropriés et vérifiez si une question similaire a déjà été résolue.\n"
            "- **Respect de la propriété intellectuelle** : Ne partagez que des ressources et des codes dont vous détenez les droits ou sous licence ouverte.\n"
            "- **Confidentialité** : Il est interdit de divulguer hors d'une communauté privée des contenus réservés à ses membres."
        ),
        "metadata": {},
    },
    {
        "slug": "depannage-et-resolution-problemes",
        "title": "Dépannage et résolution des problèmes courants (FAQ Technique)",
        "category": DocumentationCategory.TROUBLESHOOTING,
        "version": "1.1.0",
        "is_active": True,
        "summary": "Solutions aux difficultés fréquentes : paiement en attente, accès refusé à un cours, problème de connexion OAuth, notifications.",
        "keywords": [
            "problème",
            "erreur",
            "bug",
            "dépannage",
            "paiement en attente",
            "pending",
            "accès refusé",
            "impossible",
            "aide",
            "support",
            "faq",
        ],
        "content": (
            "# Dépannage & Résolution des difficultés sur Kodinga\n\n"
            "## 1. Mon paiement reste en statut « En attente (Pending) »\n"
            "- Vérifiez que vous avez bien validé la transaction sur votre téléphone (code secret Wave ou Orange Money).\n"
            "- Depuis la page de paiement ou l'historique de facturation (`/dashboard/billing`), cliquez sur **« Vérifier le statut »** pour synchroniser votre transaction.\n\n"
            "## 2. Je ne peux pas accéder aux cours ou modules d'une communauté\n"
            "- Assurez-vous d'être connecté et d'être **membre actif (`active`)** de cette communauté.\n"
            "- Si la communauté est payante, vérifiez que votre abonnement est à jour.\n\n"
            "## 3. Je ne reçois pas l'email de vérification ou de réinitialisation\n"
            "- Vérifiez votre dossier Courriers indésirables (Spam).\n"
            "- Utilisez le bouton « Renvoyer l'email de vérification » depuis l'écran de connexion."
        ),
        "metadata": {"route": "/dashboard/billing"},
    },
]


class Command(BaseCommand):
    help = "Seeds or updates the official Kodinga platform documentation (SOURCE A) for the Platform-Aware AI Assistant."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for doc_data in OFFICIAL_KODINGA_DOCS:
            obj, created = PlatformDocumentation.objects.update_or_create(
                slug=doc_data["slug"],
                defaults={
                    "title": doc_data["title"],
                    "category": doc_data["category"],
                    "version": doc_data["version"],
                    "is_active": doc_data["is_active"],
                    "summary": doc_data["summary"],
                    "keywords": doc_data["keywords"],
                    "content": doc_data["content"],
                    "metadata": doc_data["metadata"],
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Documentation officielle Kodinga synchronisée : {created_count} créé(s), {updated_count} mis à jour."
            )
        )

        # Synchronize all existing communities into the AI knowledge base
        from apps.ai.services.platform_knowledge_service import (
            PlatformDocumentationRAGService,
        )
        from apps.communities.models.community import Community

        communities = Community.objects.select_related("category").all()
        synced_comm_count = 0
        for comm in communities:
            if PlatformDocumentationRAGService.sync_community_knowledge(comm):
                synced_comm_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Connaissances des communautés synchronisées : {synced_comm_count} communauté(s) active(s) indexée(s)."
            )
        )
