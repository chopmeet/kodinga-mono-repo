from rest_framework import serializers


class MinimalCommunitySerializer(serializers.Serializer):
    """
    Minimal representation of a community for cards and list items.
    """
    id = serializers.CharField(help_text="Identifiant unique de la communauté")
    name = serializers.CharField(help_text="Nom de la communauté")
    slug = serializers.CharField(help_text="Slug URL de la communauté")
    logo_url = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
        help_text="URL du logo de la communauté",
    )


# ==============================================================================
# HACKATHONS SERIALIZERS
# ==============================================================================

class MemberHackathonWonPrizeSerializer(serializers.Serializer):
    """
    Prize won by the member or member's team in a hackathon.
    """
    id = serializers.CharField(help_text="Identifiant du prix")
    title = serializers.CharField(help_text="Titre du prix (ex: 1er Prix - Vainqueur)")
    rank = serializers.IntegerField(help_text="Rang cible du prix (1 = 1ère place)")
    reward_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        help_text="Montant financier du prix",
    )
    reward_currency = serializers.CharField(help_text="Devise du prix (ex: XOF)")
    reward_description = serializers.CharField(
        allow_blank=True,
        help_text="Description du lot matériel ou accompagnement",
    )


class MemberHackathonSubmissionSerializer(serializers.Serializer):
    """
    Member's project submission details for a hackathon.
    """
    id = serializers.CharField(help_text="Identifiant de la soumission")
    title = serializers.CharField(help_text="Titre du projet soumis")
    slug = serializers.CharField(help_text="Slug du projet")
    status = serializers.CharField(help_text="Statut de la soumission (draft ou submitted)")
    is_final = serializers.BooleanField(help_text="Indique si le projet a été officiellement finalisé")
    submitted_at = serializers.DateTimeField(
        allow_null=True,
        help_text="Date et heure de soumission officielle",
    )
    rank = serializers.IntegerField(
        allow_null=True,
        help_text="Rang final au classement du hackathon (1 = Vainqueur, 2 = 2ème, etc.)",
    )
    total_score = serializers.FloatField(
        help_text="Note moyenne ou score total attribué par les juges",
    )
    demo_url = serializers.CharField(
        allow_blank=True,
        help_text="Lien vers la démonstration ou prototype en ligne",
    )
    repository_url = serializers.CharField(
        allow_blank=True,
        help_text="Lien vers le dépôt Git public du projet",
    )
    prizes_won = serializers.ListField(
        child=MemberHackathonWonPrizeSerializer(),
        help_text="Prix et récompenses remportés par ce projet",
    )


class MemberHackathonTeamSerializer(serializers.Serializer):
    """
    Team information if the member participated as a team.
    """
    id = serializers.CharField(help_text="Identifiant de l'équipe")
    name = serializers.CharField(help_text="Nom de l'équipe")
    slug = serializers.CharField(help_text="Slug de l'équipe")
    role = serializers.CharField(help_text="Rôle du membre (leader ou member)")
    is_leader = serializers.BooleanField(help_text="True si le membre est le capitaine de l'équipe")
    avatar_url = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        help_text="Avatar ou logo de l'équipe",
    )


class MemberHackathonApplicationSerializer(serializers.Serializer):
    """
    Application tracking for the hackathon.
    """
    id = serializers.CharField(help_text="Identifiant de la candidature")
    status = serializers.CharField(
        help_text="Statut (pending, accepted, rejected, waitlisted, withdrawn)",
    )
    status_display = serializers.CharField(help_text="Libellé lisible du statut de candidature")
    participation_mode = serializers.CharField(help_text="Mode d'inscription (individual ou team)")
    created_at = serializers.DateTimeField(help_text="Date de dépôt de la candidature")
    reviewed_at = serializers.DateTimeField(
        allow_null=True,
        help_text="Date d'examen par les organisateurs",
    )


class MemberHackathonItemSerializer(serializers.Serializer):
    """
    Detailed item for a hackathon in which the member participated.
    """
    id = serializers.CharField(help_text="Identifiant unique du hackathon")
    title = serializers.CharField(help_text="Titre du hackathon")
    slug = serializers.CharField(help_text="Slug URL du hackathon")
    tagline = serializers.CharField(allow_blank=True, help_text="Slogan d'accroche")
    banner_url = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        help_text="Bannière illustrative",
    )
    status = serializers.CharField(help_text="Statut du hackathon (draft, published, ongoing, judging, completed, cancelled)")
    status_display = serializers.CharField(help_text="Libellé lisible du statut du hackathon")
    start_time = serializers.DateTimeField(help_text="Date et heure de début")
    end_time = serializers.DateTimeField(help_text="Date et heure de clôture")
    community = MinimalCommunitySerializer(allow_null=True, help_text="Communauté organisatrice")
    participation_mode = serializers.CharField(help_text="Mode d'inscription (individual ou team)")
    application = MemberHackathonApplicationSerializer(
        allow_null=True,
        help_text="Détails de la candidature du membre",
    )
    team = MemberHackathonTeamSerializer(
        allow_null=True,
        help_text="Détails de l'équipe si participation en équipe",
    )
    submission = MemberHackathonSubmissionSerializer(
        allow_null=True,
        help_text="Projet soumis pour évaluation",
    )
    member_result = serializers.CharField(
        help_text="Résultat synthétique pour le membre: won, podium, submitted, in_progress, rejected, failed, pending",
    )
    is_winner = serializers.BooleanField(help_text="True si le membre/équipe a remporté au moins un prix")
    is_podium = serializers.BooleanField(help_text="True si le projet figure dans le top 3 (rang 1, 2 ou 3)")


class MemberHackathonKpiSerializer(serializers.Serializer):
    """
    Aggregated KPIs of member's hackathon participations.
    """
    total_participated = serializers.IntegerField(
        help_text="Nombre total de hackathons auxquels le membre a participé ou candidaté",
    )
    successful_count = serializers.IntegerField(
        help_text="Nombre de hackathons réussis (projet soumis avec succès ou prix remporté / podium)",
    )
    failed_count = serializers.IntegerField(
        help_text="Nombre de hackathons échoués (candidature refusée ou hackathon terminé sans soumission)",
    )
    in_progress_count = serializers.IntegerField(
        help_text="Nombre de hackathons actuellement en cours",
    )
    prizes_won_count = serializers.IntegerField(
        help_text="Nombre total de récompenses et prix remportés",
    )
    submissions_count = serializers.IntegerField(
        help_text="Nombre total de projets officiellement soumis",
    )
    success_rate = serializers.FloatField(
        help_text="Taux de réussite en pourcentage (projets réussis / hackathons participés)",
    )


class MemberHackathonsResponseSerializer(serializers.Serializer):
    """
    Response payload for GET /api/v1/analytics/member/hackathons/
    """
    kpis = MemberHackathonKpiSerializer(help_text="Indicateurs de performance des hackathons")
    hackathons = serializers.ListField(
        child=MemberHackathonItemSerializer(),
        help_text="Liste détaillée des hackathons du membre",
    )


# ==============================================================================
# EVENTS SERIALIZERS
# ==============================================================================

class MemberEventItemSerializer(serializers.Serializer):
    """
    Detailed item for an event registered or attended by the member.
    """
    id = serializers.CharField(help_text="Identifiant unique de l'événement")
    title = serializers.CharField(help_text="Titre de l'événement")
    slug = serializers.CharField(help_text="Slug URL de l'événement")
    description = serializers.CharField(allow_blank=True, help_text="Description de l'événement")
    cover_image_url = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        help_text="Image de couverture",
    )
    event_type = serializers.CharField(help_text="Type d'événement (live_stream, webinar, workshop, qna, meetup)")
    event_type_display = serializers.CharField(help_text="Libellé du type d'événement")
    format = serializers.CharField(help_text="Format (livekit, external, in_person, hybrid)")
    format_display = serializers.CharField(help_text="Libellé du format d'événement")
    status = serializers.CharField(help_text="Statut (scheduled, live, completed, cancelled)")
    status_display = serializers.CharField(help_text="Libellé du statut")
    start_time = serializers.DateTimeField(help_text="Date et heure de début")
    end_time = serializers.DateTimeField(help_text="Date et heure de fin")
    timezone = serializers.CharField(help_text="Fuseau horaire de l'événement")
    venue_name = serializers.CharField(allow_blank=True, help_text="Nom du lieu physique")
    location_address = serializers.CharField(allow_blank=True, help_text="Adresse physique")
    location_city = serializers.CharField(allow_blank=True, help_text="Ville de l'événement")
    location_country = serializers.CharField(allow_blank=True, help_text="Pays de l'événement")
    location_url = serializers.CharField(allow_blank=True, help_text="Lien externe webinaire")
    live_room_name = serializers.CharField(allow_blank=True, help_text="Identifiant de salon LiveKit")
    community = MinimalCommunitySerializer(allow_null=True, help_text="Communauté organisatrice")
    rsvp_status = serializers.CharField(help_text="Statut RSVP (attending, maybe, declined)")
    rsvp_status_display = serializers.CharField(help_text="Libellé du statut RSVP")
    registered_at = serializers.DateTimeField(help_text="Date d'inscription à l'événement")
    checked_in_at = serializers.DateTimeField(
        allow_null=True,
        help_text="Horodatage d'émargement / présence effective en direct",
    )
    is_checked_in = serializers.BooleanField(help_text="True si le membre a rejoint la session live")
    is_upcoming = serializers.BooleanField(help_text="True si l'événement est futur et programmé")
    is_in_progress = serializers.BooleanField(help_text="True si l'événement est actuellement en direct")
    is_completed = serializers.BooleanField(help_text="True si l'événement est achevé")


class MemberEventKpiSerializer(serializers.Serializer):
    """
    Aggregated KPIs of member's event registrations and attendance.
    """
    total_registered = serializers.IntegerField(
        help_text="Nombre total d'événements auxquels le membre est inscrit",
    )
    attended_count = serializers.IntegerField(
        help_text="Nombre d'événements effectivement suivis (présence confirmée / checked-in)",
    )
    upcoming_count = serializers.IntegerField(
        help_text="Nombre d'événements programmés à venir",
    )
    completed_count = serializers.IntegerField(
        help_text="Nombre d'événements passés terminés",
    )
    missed_count = serializers.IntegerField(
        help_text="Nombre d'événements terminés où le membre était absent ou désinscrit",
    )
    attendance_rate = serializers.FloatField(
        help_text="Taux de présence effectif en pourcentage (présences / total événements passés)",
    )


class MemberEventsResponseSerializer(serializers.Serializer):
    """
    Response payload for GET /api/v1/analytics/member/events/
    """
    kpis = MemberEventKpiSerializer(help_text="Indicateurs de participation aux événements")
    events = serializers.ListField(
        child=MemberEventItemSerializer(),
        help_text="Liste détaillée des événements du membre",
    )


# ==============================================================================
# OPPORTUNITIES SERIALIZERS
# ==============================================================================

class MemberOpportunityDetailSerializer(serializers.Serializer):
    """
    Details of the opportunity to which the member applied.
    """
    id = serializers.CharField(help_text="Identifiant de l'opportunité")
    title = serializers.CharField(help_text="Intitulé du poste ou de la mission")
    slug = serializers.CharField(help_text="Slug de l'opportunité")
    company_name = serializers.CharField(help_text="Nom de l'entreprise recruteuse")
    company_logo_url = serializers.CharField(allow_blank=True, help_text="Logo de l'entreprise")
    opportunity_type = serializers.CharField(help_text="Type (full_time, part_time, contract, freelance, internship, bounty)")
    opportunity_type_display = serializers.CharField(help_text="Libellé du type d'opportunité")
    workplace_type = serializers.CharField(help_text="Mode (remote, hybrid, onsite)")
    workplace_type_display = serializers.CharField(help_text="Libellé du mode de travail")
    location = serializers.CharField(help_text="Localisation géographique")
    salary_min = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        help_text="Rémunération minimum",
    )
    salary_max = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        help_text="Rémunération maximum",
    )
    currency = serializers.CharField(help_text="Devise (ex: XOF, EUR, USD)")
    experience_level = serializers.CharField(help_text="Niveau d'expérience requis (junior, mid, senior, lead, all)")
    experience_level_display = serializers.CharField(help_text="Libellé du niveau d'expérience")
    status = serializers.CharField(help_text="Statut de l'offre (open, closed, draft)")
    community = MinimalCommunitySerializer(allow_null=True, help_text="Communauté de publication")


class MemberOpportunityItemSerializer(serializers.Serializer):
    """
    Detailed candidate application item for an opportunity.
    """
    id = serializers.CharField(help_text="Identifiant de la candidature")
    status = serializers.CharField(help_text="Statut d'évaluation (pending, reviewing, shortlisted, accepted, rejected)")
    status_display = serializers.CharField(help_text="Libellé lisible du statut de candidature")
    applied_at = serializers.DateTimeField(help_text="Date de dépôt de la candidature")
    resume_url = serializers.CharField(allow_blank=True, help_text="Lien vers le CV transmis")
    portfolio_url = serializers.CharField(allow_blank=True, help_text="Lien portfolio / GitHub")
    cover_letter = serializers.CharField(allow_blank=True, help_text="Lettre de motivation")
    is_successful = serializers.BooleanField(help_text="True si la candidature a été acceptée (réussie)")
    is_failed = serializers.BooleanField(help_text="True si la candidature a été rejetée (échouée)")
    is_in_review = serializers.BooleanField(help_text="True si la candidature est toujours en cours d'évaluation")
    opportunity = MemberOpportunityDetailSerializer(help_text="Détails complets de l'opportunité")


class MemberOpportunityKpiSerializer(serializers.Serializer):
    """
    Aggregated KPIs of member's job and freelance applications.
    """
    total_applied = serializers.IntegerField(
        help_text="Nombre total de candidatures déposées",
    )
    accepted_count = serializers.IntegerField(
        help_text="Nombre de candidatures acceptées (réussies)",
    )
    rejected_count = serializers.IntegerField(
        help_text="Nombre de candidatures refusées (échouées)",
    )
    in_review_count = serializers.IntegerField(
        help_text="Nombre de candidatures en cours d'évaluation (en attente, examen, présélectionné)",
    )
    success_rate = serializers.FloatField(
        help_text="Taux de réussite / sélection en pourcentage (acceptées / total candidatures résolues)",
    )


class MemberOpportunitiesResponseSerializer(serializers.Serializer):
    """
    Response payload for GET /api/v1/analytics/member/opportunities/
    """
    kpis = MemberOpportunityKpiSerializer(help_text="Indicateurs de performance des candidatures")
    applications = serializers.ListField(
        child=MemberOpportunityItemSerializer(),
        help_text="Liste détaillée des candidatures du membre",
    )


# ==============================================================================
# CLASSROOM & COURSES SERIALIZERS (FORMATIONS & PROGRESSION MODULES)
# ==============================================================================

class MemberModuleProgressSerializer(serializers.Serializer):
    """
    Progress of the member for a specific pedagogical module within a course.
    """
    module_id = serializers.CharField(help_text="Identifiant unique du module")
    title = serializers.CharField(help_text="Titre du module pédagogique")
    order = serializers.IntegerField(help_text="Position / ordre d'affichage du module dans le cours")
    total_lessons = serializers.IntegerField(
        help_text="Nombre total de leçons présentes dans ce module",
    )
    completed_lessons = serializers.IntegerField(
        help_text="Nombre de leçons complétées par le membre dans ce module",
    )
    progress_percent = serializers.FloatField(
        help_text="Pourcentage de progression pour ce module spécifique (0.0 à 100.0%)",
    )
    is_completed = serializers.BooleanField(
        help_text="True si 100% des leçons de ce module ont été validées par le membre",
    )


class MemberCourseItemSerializer(serializers.Serializer):
    """
    Course followed by the member, including level, overall progress, and module breakdown.
    """
    id = serializers.CharField(required=False, help_text="Identifiant unique de la formation")
    course_id = serializers.CharField(help_text="Identifiant unique de la formation")
    title = serializers.CharField(help_text="Titre de la formation")
    slug = serializers.CharField(help_text="Slug URL de la formation")
    description = serializers.CharField(allow_blank=True, help_text="Description du cours")
    level = serializers.CharField(
        help_text="Niveau de difficulté (beginner, intermediate, advanced, all_levels)",
    )
    level_display = serializers.CharField(
        help_text="Libellé lisible du niveau (Débutant, Intermédiaire, Avancé, Tous niveaux)",
    )
    thumbnail_url = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        help_text="Miniature / image de couverture de la formation",
    )
    duration_seconds = serializers.IntegerField(help_text="Durée totale estimée en secondes")
    duration_minutes = serializers.IntegerField(help_text="Durée totale estimée en minutes")
    community = MinimalCommunitySerializer(allow_null=True, help_text="Communauté hébergeant le cours")
    enrolled_at = serializers.DateTimeField(help_text="Date d'inscription au cours")
    completed_at = serializers.DateTimeField(
        allow_null=True,
        help_text="Date d'achèvement complet (100%) du cours",
    )
    overall_progress_percent = serializers.FloatField(
        help_text="Pourcentage global d'avancement de la formation (0.0 à 100.0%)",
    )
    total_lessons = serializers.IntegerField(help_text="Nombre total de leçons dans la formation")
    completed_lessons = serializers.IntegerField(help_text="Nombre de leçons complétées par le membre")
    total_modules = serializers.IntegerField(help_text="Nombre total de modules pédagogiques")
    completed_modules = serializers.IntegerField(help_text="Nombre de modules terminés à 100%")
    is_completed = serializers.BooleanField(help_text="True si la formation est intégralement terminée")
    modules_progress = serializers.ListField(
        child=MemberModuleProgressSerializer(),
        help_text="Progression détaillée module par module avec le pourcentage spécifique de chaque module",
    )


class MemberCourseKpiSerializer(serializers.Serializer):
    """
    Aggregated KPIs of member's learning activities in the classroom.
    """
    total_enrolled = serializers.IntegerField(
        help_text="Nombre total de formations suivies / inscrites",
    )
    completed_count = serializers.IntegerField(
        help_text="Nombre de formations complétées à 100%",
    )
    in_progress_count = serializers.IntegerField(
        help_text="Nombre de formations en cours d'apprentissage",
    )
    total_lessons_completed = serializers.IntegerField(
        help_text="Nombre cumulé de leçons validées par le membre sur toutes les formations",
    )
    average_progress_percent = serializers.FloatField(
        help_text="Progression moyenne globale sur toutes les formations inscrites (en %)",
    )


class MemberCoursesResponseSerializer(serializers.Serializer):
    """
    Response payload for GET /api/v1/analytics/member/courses/
    """
    kpis = MemberCourseKpiSerializer(help_text="Indicateurs globaux d'apprentissage")
    courses = serializers.ListField(
        child=MemberCourseItemSerializer(),
        help_text="Liste des formations suivies avec progression globale et par module",
    )


# ==============================================================================
# UNIFIED MEMBER DASHBOARD SERIALIZER
# ==============================================================================

class MemberDashboardHighlightsSerializer(serializers.Serializer):
    """
    Top recent items across all four categories for widget display.
    """
    recent_hackathons = serializers.ListField(
        child=MemberHackathonItemSerializer(),
        help_text="Derniers hackathons (jusqu'à 3)",
    )
    recent_events = serializers.ListField(
        child=MemberEventItemSerializer(),
        help_text="Prochains événements ou récents (jusqu'à 3)",
    )
    upcoming_or_recent_events = serializers.ListField(
        child=MemberEventItemSerializer(),
        required=False,
        help_text="Prochains événements ou récents (jusqu'à 3)",
    )
    recent_opportunities = serializers.ListField(
        child=MemberOpportunityItemSerializer(),
        help_text="Dernières candidatures d'opportunités (jusqu'à 3)",
    )
    recent_opportunity_applications = serializers.ListField(
        child=MemberOpportunityItemSerializer(),
        required=False,
        help_text="Dernières candidatures d'opportunités (jusqu'à 3)",
    )
    recent_courses = serializers.ListField(
        child=MemberCourseItemSerializer(),
        help_text="Dernières formations suivies (jusqu'à 3)",
    )
    active_courses = serializers.ListField(
        child=MemberCourseItemSerializer(),
        required=False,
        help_text="Dernières formations suivies (jusqu'à 3)",
    )


class MemberDashboardKpisSerializer(serializers.Serializer):
    """
    Unified KPIs container grouping all domain metrics.
    """
    hackathons = MemberHackathonKpiSerializer(help_text="KPIs Hackathons")
    events = MemberEventKpiSerializer(help_text="KPIs Événements")
    opportunities = MemberOpportunityKpiSerializer(help_text="KPIs Opportunités")
    courses = MemberCourseKpiSerializer(help_text="KPIs Formations")


class MemberActivityDashboardResponseSerializer(serializers.Serializer):
    """
    Response payload for GET /api/v1/analytics/member/dashboard/
    Unified dashboard combining all domain KPIs and recent activity highlights.
    """
    kpis = MemberDashboardKpisSerializer(help_text="Ensemble des KPIs synthétiques du membre")
    highlights = MemberDashboardHighlightsSerializer(help_text="Aperçu des éléments récents pour les cartes du dashboard")
