from apps.profiles.selectors.profile_selector import ProfileSelector
from apps.profiles.serializers.education import DeveloperEducationSerializer
from apps.profiles.serializers.experience import DeveloperExperienceSerializer
from apps.profiles.serializers.portfolio import DeveloperPortfolioProjectSerializer
from apps.profiles.serializers.skill import (
    DeveloperSkillCreateUpdateSerializer,
    DeveloperSkillSerializer,
)
from apps.profiles.serializers.technology import TechnologySerializer
from apps.profiles.services.profile_service import ProfileService
from common.utils.responses import error_response, success_response
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView


class TechnologyListView(APIView):
    """
    Autocomplete & catalog of developer technologies and tools.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Profiles'],
        summary="Lister ou rechercher des technologies du catalogue",
        parameters=[
            OpenApiParameter(name='search', description="Recherche par nom ou slug", required=False, type=str),
            OpenApiParameter(name='category', description="Catégorie (frontend, backend, devops...)", required=False, type=str),
        ],
        responses={200: TechnologySerializer(many=True)}
    )
    def get(self, request):
        search = request.query_params.get('search')
        category = request.query_params.get('category')
        techs = ProfileSelector.get_technologies(search=search, category=category)
        return success_response(data=TechnologySerializer(techs[:50], many=True).data)

    @extend_schema(
        tags=['Profiles'],
        summary="Proposer / Créer une nouvelle technologie",
        request=TechnologySerializer,
        responses={201: TechnologySerializer}
    )
    def post(self, request):
        if not request.user.is_authenticated:
            return error_response("Authentification requise pour ajouter une technologie.", status_code=401)
        serializer = TechnologySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tech = ProfileService.get_or_create_technology(
            name=serializer.validated_data['name'],
            category=serializer.validated_data.get('category', 'other')
        )
        return success_response(
            data=TechnologySerializer(tech).data,
            message="Technologie enregistrée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class MeSkillsView(APIView):
    """
    Manage skills associated with the authenticated developer's profile.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Lister ses compétences techniques",
        responses={200: DeveloperSkillSerializer(many=True)}
    )
    def get(self, request):
        profile = ProfileSelector.get_profile_by_user(request.user)
        return success_response(data=DeveloperSkillSerializer(profile.skills.all(), many=True).data)

    @extend_schema(
        tags=['Profiles'],
        summary="Ajouter ou mettre à jour une compétence technique",
        request=DeveloperSkillCreateUpdateSerializer,
        responses={201: DeveloperSkillSerializer}
    )
    def post(self, request):
        serializer = DeveloperSkillCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        skill = ProfileService.add_or_update_skill(
            user=request.user,
            level=data.get('level', 'intermediate'),
            years_of_experience=data.get('years_of_experience', 1),
            is_highlighted=data.get('is_highlighted', False),
            order=data.get('order', 0),
            technology_id=data.get('technology_id'),
            technology_name=data.get('technology_name'),
        )
        return success_response(
            data=DeveloperSkillSerializer(skill).data,
            message="Compétence enregistrée.",
            status_code=status.HTTP_201_CREATED
        )


class MeSkillDetailView(APIView):
    """
    Delete a specific skill from the developer profile.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Supprimer une compétence technique",
        responses={200: None}
    )
    def delete(self, request, skill_id):
        ProfileService.remove_skill(request.user, skill_id)
        return success_response(message="Compétence retirée avec succès.")


class MeExperienceView(APIView):
    """
    List and add professional experiences to the developer profile.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Lister ses expériences professionnelles",
        responses={200: DeveloperExperienceSerializer(many=True)}
    )
    def get(self, request):
        profile = ProfileSelector.get_profile_by_user(request.user)
        return success_response(data=DeveloperExperienceSerializer(profile.experiences.all(), many=True).data)

    @extend_schema(
        tags=['Profiles'],
        summary="Ajouter une expérience professionnelle",
        request=DeveloperExperienceSerializer,
        responses={201: DeveloperExperienceSerializer}
    )
    def post(self, request):
        serializer = DeveloperExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop('technology_ids', None)
        exp = ProfileService.add_experience(request.user, serializer.validated_data, tech_ids)
        return success_response(
            data=DeveloperExperienceSerializer(exp).data,
            message="Expérience ajoutée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class MeExperienceDetailView(APIView):
    """
    Update or delete a professional experience.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Mettre à jour une expérience professionnelle",
        request=DeveloperExperienceSerializer,
        responses={200: DeveloperExperienceSerializer}
    )
    def patch(self, request, experience_id):
        serializer = DeveloperExperienceSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop('technology_ids', None)
        exp = ProfileService.update_experience(request.user, experience_id, serializer.validated_data, tech_ids)
        return success_response(
            data=DeveloperExperienceSerializer(exp).data,
            message="Expérience mise à jour avec succès."
        )

    @extend_schema(
        tags=['Profiles'],
        summary="Supprimer une expérience professionnelle",
        responses={200: None}
    )
    def delete(self, request, experience_id):
        ProfileService.delete_experience(request.user, experience_id)
        return success_response(message="Expérience supprimée avec succès.")


class MeEducationView(APIView):
    """
    List and add educations/certifications to the developer profile.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Lister ses formations et diplômes",
        responses={200: DeveloperEducationSerializer(many=True)}
    )
    def get(self, request):
        profile = ProfileSelector.get_profile_by_user(request.user)
        return success_response(data=DeveloperEducationSerializer(profile.educations.all(), many=True).data)

    @extend_schema(
        tags=['Profiles'],
        summary="Ajouter une formation ou diplôme",
        request=DeveloperEducationSerializer,
        responses={201: DeveloperEducationSerializer}
    )
    def post(self, request):
        serializer = DeveloperEducationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        edu = ProfileService.add_education(request.user, serializer.validated_data)
        return success_response(
            data=DeveloperEducationSerializer(edu).data,
            message="Formation ajoutée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class MeEducationDetailView(APIView):
    """
    Update or delete an education entry.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Mettre à jour une formation",
        request=DeveloperEducationSerializer,
        responses={200: DeveloperEducationSerializer}
    )
    def patch(self, request, education_id):
        serializer = DeveloperEducationSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        edu = ProfileService.update_education(request.user, education_id, serializer.validated_data)
        return success_response(
            data=DeveloperEducationSerializer(edu).data,
            message="Formation mise à jour avec succès."
        )

    @extend_schema(
        tags=['Profiles'],
        summary="Supprimer une formation",
        responses={200: None}
    )
    def delete(self, request, education_id):
        ProfileService.delete_education(request.user, education_id)
        return success_response(message="Formation supprimée avec succès.")


class MePortfolioView(APIView):
    """
    List and add showcase projects to developer profile portfolio.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Lister ses projets phares du portfolio",
        responses={200: DeveloperPortfolioProjectSerializer(many=True)}
    )
    def get(self, request):
        profile = ProfileSelector.get_profile_by_user(request.user)
        return success_response(data=DeveloperPortfolioProjectSerializer(profile.portfolio_projects.all(), many=True).data)

    @extend_schema(
        tags=['Profiles'],
        summary="Ajouter un projet de portfolio",
        request=DeveloperPortfolioProjectSerializer,
        responses={201: DeveloperPortfolioProjectSerializer}
    )
    def post(self, request):
        serializer = DeveloperPortfolioProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop('technology_ids', None)
        project = ProfileService.add_portfolio_project(request.user, serializer.validated_data, tech_ids)
        return success_response(
            data=DeveloperPortfolioProjectSerializer(project).data,
            message="Projet de portfolio ajouté avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class MePortfolioDetailView(APIView):
    """
    Update or delete a portfolio project.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Profiles'],
        summary="Mettre à jour un projet de portfolio",
        request=DeveloperPortfolioProjectSerializer,
        responses={200: DeveloperPortfolioProjectSerializer}
    )
    def patch(self, request, project_id):
        serializer = DeveloperPortfolioProjectSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop('technology_ids', None)
        project = ProfileService.update_portfolio_project(request.user, project_id, serializer.validated_data, tech_ids)
        return success_response(
            data=DeveloperPortfolioProjectSerializer(project).data,
            message="Projet mis à jour avec succès."
        )

    @extend_schema(
        tags=['Profiles'],
        summary="Supprimer un projet de portfolio",
        responses={200: None}
    )
    def delete(self, request, project_id):
        ProfileService.delete_portfolio_project(request.user, project_id)
        return success_response(message="Projet supprimé avec succès.")
