from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.communities.models.community import Community
from apps.opportunities.models.application import OpportunityApplication
from apps.opportunities.models.opportunity import Opportunity
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


@extend_schema(tags=["Opportunities"])
class OpportunityListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        opp_type = request.query_params.get("type")
        workplace = request.query_params.get("workplace")
        experience = request.query_params.get("experience")
        search = request.query_params.get("search")
        tech = request.query_params.get("tech")
        community = request.query_params.get("community")

        opportunities = OpportunitySelector.list_opportunities(
            opportunity_type=opp_type,
            workplace_type=workplace,
            experience_level=experience,
            search=search,
            technology_slug=tech,
            community_slug=community,
        )

        if request.user.is_authenticated:
            applied_ids = set(
                OpportunityApplication.objects.filter(
                    applicant=request.user, opportunity__in=opportunities
                ).values_list("opportunity_id", flat=True)
            )
            for o in opportunities:
                setattr(o, "has_applied", o.id in applied_ids)

        return Response(OpportunitySerializer(opportunities, many=True).data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED
            )

        serializer = CreateOpportunitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tech_ids = serializer.validated_data.pop("technology_ids", [])
        community_id = serializer.validated_data.pop("community_id", None)
        community = Community.objects.filter(id=community_id).first() if community_id else None

        opportunity = OpportunityService.create_opportunity(
            poster=request.user,
            validated_data={**serializer.validated_data, "community": community},
            technology_ids=tech_ids,
        )
        return Response(
            OpportunityDetailSerializer(opportunity).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Opportunities"])
class MyOpportunityListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        opportunities = OpportunitySelector.get_user_posted_opportunities(request.user)
        return Response(OpportunitySerializer(opportunities, many=True).data)


@extend_schema(tags=["Opportunities"])
class MyApplicationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        applications = OpportunitySelector.get_user_applications(request.user)
        return Response(OpportunityApplicationSerializer(applications, many=True).data)


@extend_schema(tags=["Opportunities"])
class OpportunityDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        opportunity = OpportunitySelector.get_opportunity_by_slug(slug, viewer=request.user)
        if not opportunity:
            return Response({"detail": "Opportunité introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OpportunityDetailSerializer(opportunity).data)

    def patch(self, request, slug):
        if not request.user.is_authenticated:
            return Response({"detail": "Non authentifié."}, status=status.HTTP_401_UNAUTHORIZED)
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return Response({"detail": "Opportunité introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateOpportunitySerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop("technology_ids", None)
        community_id = serializer.validated_data.pop("community_id", None)
        if community_id is not None:
            serializer.validated_data["community"] = Community.objects.filter(id=community_id).first()

        updated_opp = OpportunityService.update_opportunity(
            opportunity=opportunity,
            user=request.user,
            validated_data=serializer.validated_data,
            technology_ids=tech_ids,
        )
        return Response(OpportunityDetailSerializer(updated_opp).data)

    def delete(self, request, slug):
        if not request.user.is_authenticated:
            return Response({"detail": "Non authentifié."}, status=status.HTTP_401_UNAUTHORIZED)
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return Response({"detail": "Opportunité introuvable."}, status=status.HTTP_404_NOT_FOUND)

        OpportunityService.close_opportunity(opportunity, request.user)
        return Response({"status": "closed"})


@extend_schema(tags=["Opportunities"])
class OpportunityApplyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return Response({"detail": "Opportunité introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        application = OpportunityService.apply_to_opportunity(
            opportunity=opportunity,
            applicant=request.user,
            data=serializer.validated_data,
        )
        return Response(
            OpportunityApplicationSerializer(application).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Opportunities"])
class OpportunityApplicationsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        opportunity = Opportunity.objects.filter(slug=slug).first()
        if not opportunity:
            return Response({"detail": "Opportunité introuvable."}, status=status.HTTP_404_NOT_FOUND)

        applications = OpportunitySelector.get_opportunity_applications(opportunity, request.user)
        return Response(OpportunityApplicationSerializer(applications, many=True).data)


@extend_schema(tags=["Opportunities"])
class ApplicationStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, application_id):
        application = OpportunityApplication.objects.filter(id=application_id).first()
        if not application:
            return Response({"detail": "Candidature introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateApplicationStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_app = OpportunityService.update_application_status(
            application=application,
            user=request.user,
            new_status=serializer.validated_data["status"],
        )
        return Response(OpportunityApplicationSerializer(updated_app).data)
