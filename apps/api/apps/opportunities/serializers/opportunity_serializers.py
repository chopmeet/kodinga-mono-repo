from rest_framework import serializers

from apps.accounts.models.user import User
from apps.opportunities.models.application import (
    ApplicationStatus,
    OpportunityApplication,
)
from apps.opportunities.models.opportunity import (
    ExperienceLevel,
    Opportunity,
    OpportunityStatus,
    OpportunityType,
    WorkplaceType,
)
from apps.profiles.models.technology import Technology


class OpportunityPosterSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar_url"]

    def get_avatar_url(self, obj) -> str:
        profile = getattr(obj, "profile", None)
        return profile.avatar_url if profile else ""


class OpportunityTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ["id", "name", "slug", "icon_url"]


class OpportunitySerializer(serializers.ModelSerializer):
    poster = OpportunityPosterSerializer(read_only=True)
    technologies = OpportunityTechnologySerializer(many=True, read_only=True)
    has_applied = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Opportunity
        fields = [
            "id",
            "title",
            "slug",
            "company_name",
            "company_logo_url",
            "company_website",
            "opportunity_type",
            "workplace_type",
            "location",
            "salary_min",
            "salary_max",
            "currency",
            "experience_level",
            "status",
            "views_count",
            "applications_count",
            "expires_at",
            "has_applied",
            "community_id",
            "poster",
            "technologies",
            "created_at",
        ]


class OpportunityDetailSerializer(serializers.ModelSerializer):
    poster = OpportunityPosterSerializer(read_only=True)
    technologies = OpportunityTechnologySerializer(many=True, read_only=True)
    has_applied = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Opportunity
        fields = [
            "id",
            "title",
            "slug",
            "company_name",
            "company_logo_url",
            "company_website",
            "opportunity_type",
            "workplace_type",
            "location",
            "salary_min",
            "salary_max",
            "currency",
            "experience_level",
            "description",
            "requirements",
            "apply_url",
            "apply_email",
            "status",
            "views_count",
            "applications_count",
            "expires_at",
            "has_applied",
            "community_id",
            "poster",
            "technologies",
            "created_at",
            "updated_at",
        ]


class CreateOpportunitySerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        required=True,
        help_text="Intitulé du poste ou de la mission (ex: Lead Backend Engineer, Stage Full-Stack...)",
    )
    company_name = serializers.CharField(
        max_length=255,
        required=True,
        help_text="Nom de l'entreprise ou du porteur de projet",
    )
    company_logo_url = serializers.URLField(
        required=False,
        allow_blank=True,
        default="",
        help_text="URL du logo de l'entreprise (uploadé via /api/v1/media/upload/ ou lien externe)",
    )
    company_website = serializers.URLField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Site web officiel de l'entreprise",
    )
    opportunity_type = serializers.ChoiceField(
        choices=OpportunityType.choices,
        default=OpportunityType.FULL_TIME,
        help_text="Type de contrat : full_time (CDI), part_time (Temps partiel), contract (CDD), freelance (Mission Freelance), internship (Stage), bounty (Bounty)",
    )
    workplace_type = serializers.ChoiceField(
        choices=WorkplaceType.choices,
        default=WorkplaceType.REMOTE,
        help_text="Mode d'organisation : remote (100% télétravail), hybrid (hybride), onsite (sur site)",
    )
    location = serializers.CharField(
        max_length=255,
        required=False,
        default="Remote",
        help_text="Localisation géographique (ex: Dakar, Sénégal / Abidjan / Remote)",
    )
    salary_min = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        default=None,
        help_text="Rémunération minimum (mensuelle pour CDI/stage, TJM ou forfait pour freelance)",
    )
    salary_max = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
        default=None,
        help_text="Rémunération maximum",
    )
    currency = serializers.CharField(
        max_length=10,
        default="XOF",
        help_text="Devise monétaire (ex: XOF, EUR, USD)",
    )
    experience_level = serializers.ChoiceField(
        choices=ExperienceLevel.choices,
        default=ExperienceLevel.ALL,
        help_text="Niveau d'expérience requis : all (tous niveaux), junior (0-2 ans), mid (2-5 ans), senior (5+ ans), lead (Lead / Architecte)",
    )
    description = serializers.CharField(
        required=True,
        help_text="Description détaillée du poste, de la mission freelance ou du stage",
    )
    requirements = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Compétences, prérequis et qualifications attendues",
    )
    apply_url = serializers.URLField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Lien externe pour postuler (optionnel; si omis, candidature directe sur Kodinga)",
    )
    apply_email = serializers.EmailField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Email de contact pour les candidatures (optionnel)",
    )
    status = serializers.ChoiceField(
        choices=OpportunityStatus.choices,
        default=OpportunityStatus.OPEN,
        help_text="Statut initial de l'offre : open (ouverte), closed (fermée), draft (brouillon)",
    )
    community_id = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
        help_text="UUID de la communauté de rattachement (optionnel, l'auteur doit être membre)",
    )
    technology_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
        help_text="Liste des UUIDs des technologies associées (disponibles via /api/v1/profiles/technologies/)",
    )

    def validate_community_id(self, value):
        if not value or str(value).strip().lower() in ("", "null", "none"):
            return None
        import uuid
        try:
            return uuid.UUID(str(value))
        except (ValueError, TypeError, AttributeError) as err:
            raise serializers.ValidationError("community_id doit être un UUID valide.") from err


class OpportunityApplicationSerializer(serializers.ModelSerializer):
    applicant = OpportunityPosterSerializer(read_only=True)
    opportunity = OpportunitySerializer(read_only=True)

    class Meta:
        model = OpportunityApplication
        fields = [
            "id",
            "opportunity",
            "applicant",
            "resume_url",
            "cover_letter",
            "portfolio_url",
            "status",
            "created_at",
            "updated_at",
        ]


class CreateApplicationSerializer(serializers.Serializer):
    resume_url = serializers.URLField(
        required=False,
        allow_blank=True,
        default="",
        help_text="URL du CV du candidat (stocké via /api/v1/media/upload/ sur UploadThing ou URL externe)",
    )
    cover_letter = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Lettre de motivation ou message de présentation au recruteur",
    )
    portfolio_url = serializers.URLField(
        required=False,
        allow_blank=True,
        default="",
        help_text="Lien vers le portfolio en ligne, profil GitHub, GitLab ou projet de démonstration",
    )


class UpdateApplicationStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=ApplicationStatus.choices,
        help_text="Nouveau statut : pending (En attente), reviewing (En cours d'examen), shortlisted (Présélectionné), accepted (Accepté), rejected (Refusé)",
    )
