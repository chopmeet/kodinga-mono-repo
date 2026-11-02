from apps.communities.models.community import Community
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.permissions import (
    check_community_membership,
    check_community_read_permission,
)
from apps.opportunities.models.application import (
    OpportunityApplication,
)
from apps.opportunities.models.opportunity import (
    ExperienceLevel,
    Opportunity,
    OpportunityType,
    WorkplaceType,
)
from apps.opportunities.selectors.opportunity_selector import (
    OpportunitySelector,
)
from apps.opportunities.serializers.opportunity_serializers import (
    CreateApplicationSerializer,
    CreateOpportunitySerializer,
    OpportunityApplicationSerializer,
    OpportunityDetailSerializer,
    OpportunitySerializer,
    UpdateApplicationStatusSerializer,
)
from apps.opportunities.services.opportunity_service import OpportunityService
from common.utils.responses import error_response, success_response
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import permissions, status
from rest_framework.views import APIView


class OpportunityListView(APIView):
    """
    Explore and publish tech job offers, internships, freelance missions and bounties.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = OpportunitySerializer

    @extend_schema(
        tags=["Opportunities"],
        summary="Lister et rechercher les opportunités tech (Emplois, Stages, Missions)",
        description=(
            "Recherche multicritère d'opportunités d'emploi pour développeurs : "
            "CDI (full_time), CDD (contract), stages (internship), missions freelance (freelance), "
            "bounties open source (bounty). Filtres disponibles par type de contrat, mode de travail "
            "(remote, hybrid, onsite), niveau d'expérience, recherche textuelle, technologie et communauté."
        ),
        parameters=[
            OpenApiParameter(
                name="type",
                type=str,
                enum=[c[0] for c in OpportunityType.choices],
                required=False,
                description="Filtrer par type de contrat (full_time, part_time, contract, freelance, internship, bounty)",
            ),
            OpenApiParameter(
                name="workplace",
                type=str,
                enum=[c[0] for c in WorkplaceType.choices],
                required=False,
                description="Filtrer par organisation du travail (remote, hybrid, onsite)",
            ),
            OpenApiParameter(
                name="experience",
                type=str,
                enum=[c[0] for c in ExperienceLevel.choices],
                required=False,
                description="Filtrer par niveau d'expérience (all, junior, mid, senior, lead)",
            ),
            OpenApiParameter(
                name="search",
                type=str,
                required=False,
                description="Recherche textuelle dans l'intitulé, le nom de l'entreprise, le lieu ou la description",
            ),
            OpenApiParameter(
                name="tech",
                type=str,
                required=False,
                description="Filtrer par slug de technologie (ex: python, react, docker)",
            ),
            OpenApiParameter(
                name="community",
                type=str,
                required=False,
                description="Filtrer par slug de la communauté associée",
            ),
        ],
        responses={
            200: OpenApiResponse(
                response=OpportunitySerializer(many=True),
                description="Liste des opportunités ouvertes correspondant aux filtres",
            ),
        },
    )
    def get(self, request):
        opp_type = request.query_params.get("type")
        workplace = request.query_params.get("workplace")
        experience = request.query_params.get("experience")
        search = request.query_params.get("search")
        tech = request.query_params.get("tech")
        community_slug = request.query_params.get("community")

        if community_slug:
            try:
                community = CommunitySelector.get_community_by_slug(community_slug, user=request.user)
            except Community.DoesNotExist:
                return error_response(
                    "Communauté introuvable.",
                    code="resource_not_found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            check_community_read_permission(request.user, community)

        opportunities = OpportunitySelector.list_opportunities(
            opportunity_type=opp_type,
            workplace_type=workplace,
            experience_level=experience,
            search=search,
            technology_slug=tech,
            community_slug=community_slug,
            viewer=request.user,
        )

        if request.user.is_authenticated:
            applied_ids = set(
                OpportunityApplication.objects.filter(
                    applicant=request.user, opportunity__in=opportunities
                ).values_list("opportunity_id", flat=True)
            )
            for o in opportunities:
                o.has_applied = o.id in applied_ids

        return success_response(data=OpportunitySerializer(opportunities, many=True).data)

    @extend_schema(
        tags=["Opportunities"],
        summary="Publier une opportunité (Emploi CDI/CDD, Stage, Mission Freelance, Bounty)",
        description=(
            "Permet à un recruteur ou membre de la communauté de créer une opportunité tech. "
            "Si un `community_id` est spécifié, l'auteur doit obligatoirement être membre de cette communauté."
        ),
        request=CreateOpportunitySerializer,
        responses={
            201: OpenApiResponse(
                response=OpportunityDetailSerializer,
                description="Opportunité créée avec succès",
            ),
            400: OpenApiResponse(description="Erreur de validation des champs"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Action interdite : vous n'êtes pas membre de la communauté cible"),
            404: OpenApiResponse(description="Communauté introuvable"),
        },
        examples=[
            OpenApiExample(
                name="Exemple 1 : CDI Full-Stack Senior",
                summary="Publication d'une offre d'emploi CDI senior (Python / React)",
                value={
                    "title": "Lead Full-Stack Python & React Engineer",
                    "company_name": "Kodinga Innovations",
                    "company_logo_url": "https://kodinga.com/static/brand/logo.png",
                    "company_website": "https://kodinga.com",
                    "opportunity_type": "full_time",
                    "workplace_type": "remote",
                    "location": "Dakar, Sénégal / Remote",
                    "salary_min": "1500000.00",
                    "salary_max": "2500000.00",
                    "currency": "XOF",
                    "experience_level": "senior",
                    "description": "Nous recherchons un développeur Full-Stack Senior pour accélérer la croissance de nos plateformes cloud.",
                    "requirements": "- 5+ ans d'expérience avec Python et Django\n- Maîtrise de React, TypeScript et TailwindCSS\n- Expérience en architecture distribuée et Docker",
                    "apply_url": "",
                    "apply_email": "jobs@kodinga.com",
                    "status": "open",
                    "community_id": None,
                    "technology_ids": [],
                },
                request_only=True,
            ),
            OpenApiExample(
                name="Exemple 2 : Mission Freelance DevOps",
                summary="Publication d'une mission freelance (Kubernetes / CI-CD)",
                value={
                    "title": "Mission Freelance - Architecture Cloud & CI/CD",
                    "company_name": "Fintech Solutions",
                    "company_logo_url": "https://example.com/fintech.png",
                    "company_website": "https://example.com",
                    "opportunity_type": "freelance",
                    "workplace_type": "remote",
                    "location": "Remote",
                    "salary_min": "300000.00",
                    "salary_max": "500000.00",
                    "currency": "XOF",
                    "experience_level": "lead",
                    "description": "Mission freelance de 3 semaines pour auditer et automatiser le déploiement de nos microservices.",
                    "requirements": "- Maîtrise de Kubernetes, Helm et Terraform\n- GitHub Actions et monitoring Prometheus",
                    "apply_url": "",
                    "apply_email": "",
                    "status": "open",
                    "community_id": None,
                    "technology_ids": [],
                },
                request_only=True,
            ),
            OpenApiExample(
                name="Exemple 3 : Stage Développeur Frontend",
                summary="Publication d'un stage pré-embauche",
                value={
                    "title": "Stage Développeur Frontend React / Next.js",
                    "company_name": "Studio Web Africa",
                    "company_logo_url": "https://example.com/studio.png",
                    "company_website": "https://example.com",
                    "opportunity_type": "internship",
                    "workplace_type": "hybrid",
                    "location": "Abidjan, Côte d'Ivoire",
                    "salary_min": "150000.00",
                    "salary_max": "250000.00",
                    "currency": "XOF",
                    "experience_level": "junior",
                    "description": "Stage de 6 mois pour intégrer nos maquettes Figma et développer des fonctionnalités interactives.",
                    "requirements": "Bases solides en JavaScript, React, HTML5 et CSS3. Passionné par l'UX/UI.",
                    "apply_url": "",
                    "apply_email": "",
                    "status": "open",
                    "community_id": None,
                    "technology_ids": [],
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request):
        if not request.user.is_authenticated:
            return error_response(
                "Authentification requise.",
                code="authentication_required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = CreateOpportunitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tech_ids = serializer.validated_data.pop("technology_ids", [])
        community_id = serializer.validated_data.pop("community_id", None)
        community = None
        if community_id:
            community = Community.objects.filter(id=community_id).first()
            if not community:
                return error_response(
                    "Communauté introuvable.",
                    code="resource_not_found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            check_community_membership(request.user, community, "publier une opportunité dans cette communauté")

        opportunity = OpportunityService.create_opportunity(
            poster=request.user,
            validated_data={**serializer.validated_data, "community": community},
            technology_ids=tech_ids,
        )
        return success_response(
            data=OpportunityDetailSerializer(opportunity).data,
            message="Opportunité créée avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class MyOpportunityListView(APIView):
    """
    Opportunities posted by the authenticated recruiter or member.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OpportunitySerializer

    @extend_schema(
        tags=["Opportunities"],
        summary="Mes offres publiées (Espace Recruteur)",
        description=(
            "Renvoie la liste complète des offres d'emploi, stages ou missions freelance créées "
            "par l'utilisateur connecté avec les compteurs de vues et de candidatures reçues."
        ),
        responses={
            200: OpenApiResponse(
                response=OpportunitySerializer(many=True),
                description="Liste de mes opportunités",
            ),
            401: OpenApiResponse(description="Authentification requise"),
        },
    )
    def get(self, request):
        opportunities = OpportunitySelector.get_user_posted_opportunities(request.user)
        return success_response(data=OpportunitySerializer(opportunities, many=True).data)


class MyApplicationListView(APIView):
    """
    Applications submitted by the authenticated candidate.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OpportunityApplicationSerializer

    @extend_schema(
        tags=["Opportunities"],
        summary="Mes candidatures envoyées (Espace Développeur)",
        description=(
            "Renvoie la liste des candidatures déposées par le développeur connecté avec le suivi "
            "du statut d'évaluation (en attente, en cours d'examen, présélectionné, accepté, refusé)."
        ),
        responses={
            200: OpenApiResponse(
                response=OpportunityApplicationSerializer(many=True),
                description="Liste des candidatures de l'utilisateur",
            ),
            401: OpenApiResponse(description="Authentification requise"),
        },
    )
    def get(self, request):
        applications = OpportunitySelector.get_user_applications(request.user)
        return success_response(data=OpportunityApplicationSerializer(applications, many=True).data)


class OpportunityDetailView(APIView):
    """
    Opportunity retrieval, modification and closure.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = OpportunityDetailSerializer

    @extend_schema(
        tags=["Opportunities"],
        summary="Détails d'une opportunité (par slug)",
        description=(
            "Renvoie les détails complets d'une opportunité via son slug unique. "
            "Incrémente automatiquement le compteur de vues. Si l'utilisateur est connecté, "
            "le champ `has_applied` indique s'il a déjà déposé une candidature."
        ),
        parameters=[
            OpenApiParameter(
                name="slug",
                type=str,
                location=OpenApiParameter.PATH,
                description="Slug unique de l'opportunité (ex: kodinga-innovations-lead-full-stack)",
            ),
        ],
        responses={
            200: OpenApiResponse(
                response=OpportunityDetailSerializer,
                description="Fiche détaillée de l'opportunité",
            ),
            404: OpenApiResponse(description="Opportunité introuvable"),
        },
    )
    def get(self, request, slug):
        opportunity = OpportunitySelector.get_opportunity_by_slug(slug, viewer=request.user)
        if not opportunity:
            return error_response(
                "Opportunité introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if opportunity.community:
            check_community_read_permission(request.user, opportunity.community)
        return success_response(data=OpportunityDetailSerializer(opportunity).data)

    @extend_schema(
        tags=["Opportunities"],
        summary="Modifier une opportunité (Auteur ou Admin)",
        description="Mise à jour partielle des informations de l'offre (titre, rémunération, compétences, statut).",
        parameters=[
            OpenApiParameter(
                name="slug",
                type=str,
                location=OpenApiParameter.PATH,
                description="Slug unique de l'opportunité",
            ),
        ],
        request=CreateOpportunitySerializer,
        responses={
            200: OpenApiResponse(
                response=OpportunityDetailSerializer,
                description="Opportunité mise à jour avec succès",
            ),
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Interdit : vous n'êtes pas l'auteur de cette offre"),
            404: OpenApiResponse(description="Opportunité introuvable"),
        },
    )
    def patch(self, request, slug):
        if not request.user.is_authenticated:
            return error_response(
                "Authentification requise.",
                code="authentication_required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return error_response(
                "Opportunité introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if opportunity.community:
            check_community_membership(request.user, opportunity.community, "modifier cette offre")

        serializer = CreateOpportunitySerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop("technology_ids", None)

        if "community_id" in serializer.validated_data:
            community_id = serializer.validated_data.pop("community_id")
            if community_id:
                community = Community.objects.filter(id=community_id).first()
                if not community:
                    return error_response(
                        "Communauté introuvable.",
                        code="resource_not_found",
                        status_code=status.HTTP_404_NOT_FOUND,
                    )
                check_community_membership(request.user, community, "associer cette opportunité à cette communauté")
                serializer.validated_data["community"] = community
            else:
                serializer.validated_data["community"] = None

        updated_opp = OpportunityService.update_opportunity(
            opportunity=opportunity,
            user=request.user,
            validated_data=serializer.validated_data,
            technology_ids=tech_ids,
        )
        return success_response(
            data=OpportunityDetailSerializer(updated_opp).data,
            message="Opportunité mise à jour avec succès.",
        )

    @extend_schema(
        tags=["Opportunities"],
        summary="Clôturer une opportunité (Auteur ou Admin)",
        description="Marque l'opportunité comme clôturée (`status=closed`). Plus aucune candidature ne sera acceptée.",
        parameters=[
            OpenApiParameter(
                name="slug",
                type=str,
                location=OpenApiParameter.PATH,
                description="Slug unique de l'opportunité",
            ),
        ],
        responses={
            200: OpenApiResponse(description="Offre clôturée avec succès"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Interdit : vous n'êtes pas l'auteur de cette offre"),
            404: OpenApiResponse(description="Opportunité introuvable"),
        },
    )
    def delete(self, request, slug):
        if not request.user.is_authenticated:
            return error_response(
                "Authentification requise.",
                code="authentication_required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return error_response(
                "Opportunité introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if opportunity.community:
            check_community_membership(request.user, opportunity.community, "clôturer cette offre")

        OpportunityService.close_opportunity(opportunity, request.user)
        return success_response(
            data={"status": "closed"},
            message="Opportunité clôturée avec succès.",
        )


class OpportunityApplyView(APIView):
    """
    Developer candidate application to an opportunity.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CreateApplicationSerializer

    @extend_schema(
        tags=["Opportunities"],
        summary="Postuler à une opportunité (Candidature Développeur)",
        description=(
            "Permet à un développeur de soumettre sa candidature avec son CV (URL ou UploadThing), "
            "sa lettre de motivation et son portfolio. Une notification est envoyée au recruteur."
        ),
        parameters=[
            OpenApiParameter(
                name="slug",
                type=str,
                location=OpenApiParameter.PATH,
                description="Slug unique de l'opportunité cible",
            ),
        ],
        request=CreateApplicationSerializer,
        responses={
            201: OpenApiResponse(
                response=OpportunityApplicationSerializer,
                description="Candidature enregistrée avec succès",
            ),
            400: OpenApiResponse(description="Vous avez déjà postulé ou l'opportunité est clôturée"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Vous n'êtes pas membre de la communauté associée"),
            404: OpenApiResponse(description="Opportunité introuvable"),
        },
        examples=[
            OpenApiExample(
                name="Exemple de candidature développeur",
                summary="Candidature avec CV, portfolio et message de motivation",
                value={
                    "resume_url": "https://uploadthing.com/f/mon-cv-developpeur.pdf",
                    "cover_letter": "Bonjour,\n\nJe suis très intéressé par cette opportunité. Avec 4 ans d'expérience en Python et React, je serais ravi de contribuer à vos projets.",
                    "portfolio_url": "https://github.com/mon-compte-dev",
                },
                request_only=True,
            ),
        ],
    )
    def post(self, request, slug):
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return error_response(
                "Opportunité introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if opportunity.community:
            check_community_read_permission(request.user, opportunity.community)
            check_community_membership(request.user, opportunity.community, "postuler à cette opportunité")

        serializer = CreateApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = OpportunityService.apply_to_opportunity(
            opportunity=opportunity,
            applicant=request.user,
            data=serializer.validated_data,
        )
        return success_response(
            data=OpportunityApplicationSerializer(application).data,
            message="Candidature enregistrée avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class OpportunityApplicationsListView(APIView):
    """
    List candidate applications received for a posted opportunity.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OpportunityApplicationSerializer

    @extend_schema(
        tags=["Opportunities"],
        summary="Lister les candidatures reçues pour une offre (Recruteur)",
        description=(
            "Permet au créateur de l'opportunité (ou admin) de consulter l'ensemble des candidatures "
            "reçues avec le profil du candidat, son CV, sa lettre de motivation et son statut."
        ),
        parameters=[
            OpenApiParameter(
                name="slug",
                type=str,
                location=OpenApiParameter.PATH,
                description="Slug unique de l'opportunité",
            ),
        ],
        responses={
            200: OpenApiResponse(
                response=OpportunityApplicationSerializer(many=True),
                description="Liste des candidatures reçues",
            ),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Accès réservé au recruteur auteur de l'offre"),
            404: OpenApiResponse(description="Opportunité introuvable"),
        },
    )
    def get(self, request, slug):
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return error_response(
                "Opportunité introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if opportunity.community:
            check_community_read_permission(request.user, opportunity.community)

        applications = OpportunitySelector.get_opportunity_applications(opportunity, request.user)
        return success_response(data=OpportunityApplicationSerializer(applications, many=True).data)


class ApplicationStatusUpdateView(APIView):
    """
    Candidate application status review and progression.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UpdateApplicationStatusSerializer

    @extend_schema(
        tags=["Opportunities"],
        summary="Mettre à jour le statut d'une candidature (Recruteur)",
        description=(
            "Permet au recruteur de mettre à jour le statut d'une candidature : "
            "`pending` (en attente), `reviewing` (en cours d'examen), `shortlisted` (présélectionné), "
            "`accepted` (accepté), `rejected` (refusé). Envoie une notification instantanée au candidat."
        ),
        parameters=[
            OpenApiParameter(
                name="application_id",
                type=str,
                location=OpenApiParameter.PATH,
                description="Identifiant UUID de la candidature",
            ),
        ],
        request=UpdateApplicationStatusSerializer,
        responses={
            200: OpenApiResponse(
                response=OpportunityApplicationSerializer,
                description="Candidature mise à jour avec nouveau statut",
            ),
            400: OpenApiResponse(description="Statut invalide"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Accès réservé au recruteur"),
            404: OpenApiResponse(description="Candidature introuvable"),
        },
        examples=[
            OpenApiExample(
                name="Présélectionner un candidat",
                summary="Passage de la candidature au statut présélectionné",
                value={"status": "shortlisted"},
                request_only=True,
            ),
            OpenApiExample(
                name="Accepter un candidat",
                summary="Passage de la candidature au statut accepté",
                value={"status": "accepted"},
                request_only=True,
            ),
        ],
    )
    def patch(self, request, application_id):
        application = OpportunityApplication.objects.filter(id=application_id).first()
        if not application:
            return error_response(
                "Candidature introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if application.opportunity.community:
            check_community_membership(request.user, application.opportunity.community, "gérer cette candidature")

        serializer = UpdateApplicationStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_app = OpportunityService.update_application_status(
            application=application,
            user=request.user,
            new_status=serializer.validated_data["status"],
        )
        return success_response(
            data=OpportunityApplicationSerializer(updated_app).data,
            message="Statut de la candidature mis à jour avec succès.",
        )
