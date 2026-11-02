from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.hackathons.models import (
    ApplicationStatus,
    Hackathon,
    HackathonApplication,
    HackathonCriterion,
    HackathonFormat,
    HackathonPrize,
    HackathonStatus,
    HackathonSubmission,
    HackathonTeam,
    HackathonTeamMember,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        email="owner_hack@kodinga.com",
        username="owner_hack",
        password="SecurePassword123!",
    )


@pytest.fixture
def member(db):
    return User.objects.create_user(
        email="member_hack@kodinga.com",
        username="member_hack",
        password="SecurePassword123!",
    )


@pytest.fixture
def teammate(db):
    return User.objects.create_user(
        email="teammate_hack@kodinga.com",
        username="teammate_hack",
        password="SecurePassword123!",
    )


@pytest.fixture
def stranger(db):
    return User.objects.create_user(
        email="stranger_hack@kodinga.com",
        username="stranger_hack",
        password="SecurePassword123!",
    )


@pytest.fixture
def judge_user(db):
    return User.objects.create_user(
        email="judge_hack@kodinga.com",
        username="judge_hack",
        password="SecurePassword123!",
    )


@pytest.fixture
def community(db, owner):
    cat = CommunityCategory.objects.create(name="AI & Hackathons", slug="ai-hackathons")
    comm = Community.objects.create(
        name="Dakar Tech Innovators",
        slug="dakar-tech-innovators",
        owner=owner,
        category=cat,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def active_membership(db, community, member):
    return CommunityMember.objects.create(
        community=community,
        user=member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )


@pytest.fixture
def active_teammate_membership(db, community, teammate):
    return CommunityMember.objects.create(
        community=community,
        user=teammate,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )


@pytest.fixture
def open_hackathon(db, community, owner):
    now = timezone.now()
    hack = Hackathon.objects.create(
        community=community,
        organizer=owner,
        title="West Africa FinTech Hackathon",
        slug="west-africa-fintech-hackathon",
        description="Construire le futur du paiement mobile et inclusion financière en Afrique.",
        format=HackathonFormat.ONLINE,
        registration_start=now - timedelta(days=2),
        registration_end=now + timedelta(days=5),
        start_time=now - timedelta(hours=1),
        submission_deadline=now + timedelta(days=3),
        judging_end=now + timedelta(days=5),
        status=HackathonStatus.REGISTRATION_OPEN,
        allow_teams=True,
        min_team_size=1,
        max_team_size=3,
        require_repo_url=True,
        require_demo_url=False,
    )
    HackathonCriterion.objects.create(
        hackathon=hack,
        name="Innovation & Pertinence",
        min_score=Decimal("0.0"),
        max_score=Decimal("20.0"),
        weight=Decimal("2.0"),
    )
    HackathonCriterion.objects.create(
        hackathon=hack,
        name="Qualité Technique",
        min_score=Decimal("0.0"),
        max_score=Decimal("20.0"),
        weight=Decimal("3.0"),
    )
    HackathonPrize.objects.create(
        hackathon=hack,
        title="1er Prix - Grand Lauréat",
        reward_amount=Decimal("2500000.00"),
        reward_currency="XOF",
        rank=1,
    )
    return hack


@pytest.mark.django_db
class TestHackathonCreationAndLifecycle:
    def test_owner_can_create_draft_hackathon(self, api_client, community, owner):
        api_client.force_authenticate(user=owner)
        now = timezone.now()

        payload = {
            "title": "Kodinga AI Hackathon 2026",
            "tagline": "L'IA au service de l'Afrique",
            "description": "Hackathon de 48h axé sur les modèles LLM et vision.",
            "format": "hybrid",
            "venue_city": "Dakar",
            "venue_country": "Sénégal",
            "registration_start": (now + timedelta(days=1)).isoformat(),
            "registration_end": (now + timedelta(days=10)).isoformat(),
            "start_time": (now + timedelta(days=11)).isoformat(),
            "submission_deadline": (now + timedelta(days=14)).isoformat(),
            "judging_end": (now + timedelta(days=16)).isoformat(),
            "allow_teams": True,
            "min_team_size": 2,
            "max_team_size": 5,
            "require_repo_url": True,
            "prizes": [
                {
                    "title": "Premier Prix",
                    "reward_amount": "5000000.00",
                    "reward_currency": "XOF",
                    "rank": 1,
                }
            ],
            "criteria": [
                {
                    "name": "Impact",
                    "min_score": "0.0",
                    "max_score": "20.0",
                    "weight": "1.0",
                },
                {
                    "name": "Faisabilité",
                    "min_score": "0.0",
                    "max_score": "20.0",
                    "weight": "2.0",
                },
            ],
        }

        res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/",
            payload,
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        data = res.data["data"]
        assert data["title"] == "Kodinga AI Hackathon 2026"
        assert data["slug"] == "kodinga-ai-hackathon-2026"
        assert data["status"] == "draft"
        assert len(data["prizes"]) == 1
        assert len(data["criteria"]) == 2

    def test_stranger_cannot_create_hackathon(self, api_client, community, stranger):
        api_client.force_authenticate(user=stranger)
        now = timezone.now()
        payload = {
            "title": "Unauthorized Hack",
            "description": "Hack",
            "format": "online",
            "registration_start": now.isoformat(),
            "registration_end": (now + timedelta(days=2)).isoformat(),
            "start_time": (now + timedelta(days=3)).isoformat(),
            "submission_deadline": (now + timedelta(days=4)).isoformat(),
            "judging_end": (now + timedelta(days=5)).isoformat(),
        }
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/",
            payload,
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_invalid_date_chronology_rejected(self, api_client, community, owner):
        api_client.force_authenticate(user=owner)
        now = timezone.now()
        payload = {
            "title": "Invalid Dates Hack",
            "description": "Desc",
            "registration_start": (now + timedelta(days=10)).isoformat(),
            "registration_end": (
                now + timedelta(days=2)
            ).isoformat(),  # End before start
            "start_time": (now + timedelta(days=3)).isoformat(),
            "submission_deadline": (now + timedelta(days=4)).isoformat(),
            "judging_end": (now + timedelta(days=5)).isoformat(),
        }
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/",
            payload,
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_publish_and_lifecycle_transitions(self, api_client, community, owner):
        api_client.force_authenticate(user=owner)
        now = timezone.now()
        hack = Hackathon.objects.create(
            community=community,
            organizer=owner,
            title="LifeCycle Hackathon",
            description="Testing states",
            registration_start=now - timedelta(days=1),
            registration_end=now + timedelta(days=2),
            start_time=now + timedelta(days=3),
            submission_deadline=now + timedelta(days=5),
            judging_end=now + timedelta(days=6),
            status=HackathonStatus.DRAFT,
        )

        # 1. Publish
        res_pub = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{hack.slug}/publish/",
            format="json",
        )
        assert res_pub.status_code == status.HTTP_200_OK
        hack.refresh_from_db()
        assert hack.status in [
            HackathonStatus.PUBLISHED,
            HackathonStatus.REGISTRATION_OPEN,
        ]

        # 2. Lifecycle transition to IN_PROGRESS
        res_trans = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{hack.slug}/lifecycle/",
            {"status": "in_progress"},
            format="json",
        )
        assert res_trans.status_code == status.HTTP_200_OK
        hack.refresh_from_db()
        assert hack.status == HackathonStatus.IN_PROGRESS

        # 3. Organizer dashboard metrics
        res_dash = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{hack.slug}/dashboard/",
        )
        assert res_dash.status_code == status.HTTP_200_OK
        assert "total_applications" in res_dash.data["data"]


@pytest.mark.django_db
class TestHackathonApplications:
    def test_member_can_apply_successfully(
        self, api_client, community, member, active_membership, open_hackathon
    ):
        api_client.force_authenticate(user=member)

        payload = {
            "participation_mode": "team",
            "team_name": "Cyber Wolof",
            "answers": {"experience": "3 ans en Django / Python"},
            "accept_terms": True,
        }

        res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/apply/",
            payload,
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["data"]["status"] == "accepted"  # auto_accept_applications=True

        # Check my-application endpoint
        my_res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/my-application/",
        )
        assert my_res.status_code == status.HTTP_200_OK
        assert my_res.data["data"]["team_name"] == "Cyber Wolof"

    def test_duplicate_application_fails(
        self, api_client, community, member, active_membership, open_hackathon
    ):
        api_client.force_authenticate(user=member)
        HackathonApplication.objects.create(
            hackathon=open_hackathon,
            applicant=member,
            status=ApplicationStatus.ACCEPTED,
        )

        res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/apply/",
            {"participation_mode": "individual", "accept_terms": True},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_member_only_restriction(
        self, api_client, community, stranger, open_hackathon
    ):
        open_hackathon.is_member_only = True
        open_hackathon.save()

        api_client.force_authenticate(user=stranger)
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/apply/",
            {"participation_mode": "individual", "accept_terms": True},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestHackathonTeams:
    def test_create_team_and_invite_member(
        self,
        api_client,
        community,
        member,
        teammate,
        active_membership,
        active_teammate_membership,
        open_hackathon,
    ):
        # Both member and teammate have accepted applications
        HackathonApplication.objects.create(
            hackathon=open_hackathon,
            applicant=member,
            status=ApplicationStatus.ACCEPTED,
        )
        HackathonApplication.objects.create(
            hackathon=open_hackathon,
            applicant=teammate,
            status=ApplicationStatus.ACCEPTED,
        )

        # 1. Leader creates team
        api_client.force_authenticate(user=member)
        create_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/teams/",
            {"name": "Team Dakar Innovate", "tagline": "Next-gen banking"},
            format="json",
        )
        assert create_res.status_code == status.HTTP_201_CREATED
        team_id = create_res.data["data"]["id"]

        # 2. Invite teammate
        invite_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/teams/{team_id}/invite/",
            {"identifier": teammate.username},
            format="json",
        )
        assert invite_res.status_code == status.HTTP_201_CREATED
        assert invite_res.data["data"]["status"] == "invited"

        # 3. Teammate accepts invitation
        api_client.force_authenticate(user=teammate)
        resp_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/teams/respond-invite/",
            {"team_id": team_id, "accept": True},
            format="json",
        )
        assert resp_res.status_code == status.HTTP_200_OK
        assert resp_res.data["data"]["status"] == "accepted"

        # Verify team now has 2 active members
        team = HackathonTeam.objects.get(id=team_id)
        assert team.active_members_count == 2

    def test_list_teams_unauthenticated_does_not_leak_emails(
        self,
        api_client,
        community,
        member,
        teammate,
        active_membership,
        active_teammate_membership,
        open_hackathon,
    ):
        team = HackathonTeam.objects.create(
            hackathon=open_hackathon,
            name="Alpha Squad",
            leader=member,
        )
        HackathonTeamMember.objects.create(
            team=team,
            user=member,
            role="leader",
            status="active",
        )
        HackathonTeamMember.objects.create(
            team=team,
            user=teammate,
            role="developer",
            status="active",
        )

        api_client.logout()
        res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/teams/"
        )
        assert res.status_code == status.HTTP_200_OK
        data = res.data["results"]
        assert len(data) >= 1
        team_data = next(t for t in data if t["id"] == str(team.id))

        # Security check: emails must NOT be leaked
        assert "email" not in team_data["leader"]
        assert team_data["leader"]["username"] == member.username
        for m in team_data["members"]:
            assert "email" not in m["user"]
            assert "username" in m["user"]


@pytest.mark.django_db
class TestHackathonSubmissions:
    def test_submission_lifecycle_and_deadline_enforcement(
        self, api_client, community, member, active_membership, open_hackathon
    ):
        HackathonApplication.objects.create(
            hackathon=open_hackathon,
            applicant=member,
            status=ApplicationStatus.ACCEPTED,
        )

        api_client.force_authenticate(user=member)

        # 1. Initialize draft submission
        init_res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/submissions/my-project/",
        )
        assert init_res.status_code == status.HTTP_200_OK
        assert init_res.data["data"]["is_final"] is False

        # 2. Update project details
        update_res = api_client.patch(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/submissions/my-project/",
            {
                "title": "SunuWallet Mobile",
                "tagline": "Paiement instantané offline",
                "description": "Solution complète d'inclusion financière en Afrique rurale.",
                "repository_url": "https://github.com/kodinga/sunuwallet",
                "demo_url": "https://sunuwallet.kodinga.com",
            },
            format="json",
        )
        assert update_res.status_code == status.HTTP_200_OK
        assert update_res.data["data"]["title"] == "SunuWallet Mobile"

        # 3. Attach file (PDF)
        file_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/submissions/my-project/files/",
            {
                "file_name": "pitch_deck.pdf",
                "file_url": "https://storage.kodinga.com/files/pitch_deck.pdf",
                "file_size": 1024 * 500,  # 500 KB
                "mime_type": "application/pdf",
                "file_type": "presentation_pdf",
            },
            format="json",
        )
        assert file_res.status_code == status.HTTP_201_CREATED

        # 4. Reject dangerous file extension
        bad_file_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/submissions/my-project/files/",
            {
                "file_name": "exploit.exe",
                "file_url": "https://storage.kodinga.com/files/exploit.exe",
                "file_size": 1024,
                "mime_type": "application/x-msdownload",
            },
            format="json",
        )
        assert bad_file_res.status_code == status.HTTP_400_BAD_REQUEST

        # 5. Finalize submission
        submit_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/submissions/my-project/submit/",
            format="json",
        )
        assert submit_res.status_code == status.HTTP_200_OK
        assert submit_res.data["data"]["is_final"] is True
        assert submit_res.data["data"]["status"] == "submitted"


@pytest.mark.django_db
class TestHackathonJudgingAndResults:
    def test_judging_workflow_and_results_publication(
        self,
        api_client,
        community,
        owner,
        member,
        active_membership,
        judge_user,
        open_hackathon,
    ):
        # Setup submitted project
        HackathonApplication.objects.create(
            hackathon=open_hackathon,
            applicant=member,
            status=ApplicationStatus.ACCEPTED,
        )
        sub = HackathonSubmission.objects.create(
            hackathon=open_hackathon,
            applicant=member,
            title="PayDunya QR Agent",
            description="Terminal de paiement décentralisé",
            is_final=True,
            status="submitted",
            submitted_at=timezone.now(),
        )

        # 1. Owner assigns judge
        api_client.force_authenticate(user=owner)
        assign_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/judges/",
            {"user_ids": [str(judge_user.id)]},
            format="json",
        )
        assert assign_res.status_code == status.HTTP_201_CREATED

        # 2. Judge views projects
        api_client.force_authenticate(user=judge_user)
        projects_res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/judging/projects/",
        )
        assert projects_res.status_code == status.HTTP_200_OK
        assert len(projects_res.data["results"]) == 1

        # 3. Judge evaluates project
        criteria = open_hackathon.criteria.all()
        # criteria 1: weight 2.0, criteria 2: weight 3.0 (total weight = 5.0)
        # score 1: 18.0 * 2 = 36.0, score 2: 16.0 * 3 = 48.0 -> weighted avg = 84 / 5 = 16.80
        eval_payload = {
            "scores": [
                {
                    "criterion_id": str(criteria[0].id),
                    "score": "18.0",
                    "comment": "Très innovant",
                },
                {
                    "criterion_id": str(criteria[1].id),
                    "score": "16.0",
                    "comment": "Code propre",
                },
            ],
            "general_feedback": "Excellente démonstration avec une architecture prometteuse.",
            "private_notes": "Candidat solide pour le podium.",
            "is_submitted": True,
        }

        eval_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/judging/projects/{sub.id}/evaluate/",
            eval_payload,
            format="json",
        )
        assert eval_res.status_code == status.HTTP_200_OK
        assert eval_res.data["data"]["weighted_score"] == "16.80"

        # Verify submission has score 16.80 and rank 1
        sub.refresh_from_db()
        assert sub.total_score == Decimal("16.80")
        assert sub.rank == 1

        # 4. Public results publication by owner
        api_client.force_authenticate(user=owner)
        prize = open_hackathon.prizes.first()
        pub_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/publish-results/",
            {"winners": [{"prize_id": str(prize.id), "submission_id": str(sub.id)}]},
            format="json",
        )
        assert pub_res.status_code == status.HTTP_200_OK
        assert pub_res.data["data"]["results_published"] is True

        # 5. Leaderboard is now accessible publicly
        api_client.logout()
        leader_res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/results/",
        )
        assert leader_res.status_code == status.HTTP_200_OK
        assert len(leader_res.data["data"]) == 1
        assert leader_res.data["data"][0]["title"] == "PayDunya QR Agent"
        assert len(leader_res.data["data"][0]["won_prizes"]) == 1


class TestHackathonCriteria:
    def test_criteria_crud_lifecycle(
        self, api_client, owner, stranger, community, open_hackathon
    ):
        # 1. Anonymous can list criteria
        api_client.logout()
        res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/criteria/"
        )
        assert res.status_code == status.HTTP_200_OK
        assert isinstance(res.data["data"], list)

        # 2. Stranger cannot add criterion
        api_client.force_authenticate(user=stranger)
        denied_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/criteria/",
            {
                "name": "Security",
                "min_score": "0.0",
                "max_score": "20.0",
                "weight": "1.5",
            },
            format="json",
        )
        assert denied_res.status_code == status.HTTP_403_FORBIDDEN

        # 3. Owner can add criterion
        api_client.force_authenticate(user=owner)
        create_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/criteria/",
            {
                "name": "Security & Privacy",
                "description": "Sécurité des données",
                "min_score": "0.0",
                "max_score": "20.0",
                "weight": "2.0",
            },
            format="json",
        )
        assert create_res.status_code == status.HTTP_201_CREATED
        criterion_id = create_res.data["data"]["id"]

        # 4. Owner can update criterion
        patch_res = api_client.patch(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/criteria/{criterion_id}/",
            {"name": "Security & Compliance", "weight": "2.5"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.data["data"]["name"] == "Security & Compliance"

        # 5. Owner can delete criterion
        del_res = api_client.delete(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/criteria/{criterion_id}/"
        )
        assert del_res.status_code == status.HTTP_200_OK
        assert not HackathonCriterion.objects.filter(id=criterion_id).exists()


class TestHackathonPrizes:
    def test_prizes_crud_lifecycle(
        self, api_client, owner, stranger, community, open_hackathon
    ):
        # 1. Anonymous can list prizes
        api_client.logout()
        res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/prizes/"
        )
        assert res.status_code == status.HTTP_200_OK

        # 2. Stranger cannot add prize
        api_client.force_authenticate(user=stranger)
        denied = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/prizes/",
            {"title": "Special AI Prize", "reward_amount": "500000.00", "rank": 4},
            format="json",
        )
        assert denied.status_code == status.HTTP_403_FORBIDDEN

        # 3. Owner can add prize
        api_client.force_authenticate(user=owner)
        create_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/prizes/",
            {
                "title": "Prix Coup de Cœur",
                "reward_amount": "750000.00",
                "reward_currency": "XOF",
                "reward_description": "Mentorat accéléré",
                "rank": 4,
            },
            format="json",
        )
        assert create_res.status_code == status.HTTP_201_CREATED
        prize_id = create_res.data["data"]["id"]

        # 4. Owner can update prize
        patch_res = api_client.patch(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/prizes/{prize_id}/",
            {"reward_amount": "800000.00", "title": "Prix Coup de Cœur du Public"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.data["data"]["title"] == "Prix Coup de Cœur du Public"

        # 5. Owner can delete prize
        del_res = api_client.delete(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/prizes/{prize_id}/"
        )
        assert del_res.status_code == status.HTTP_200_OK
        assert not HackathonPrize.objects.filter(id=prize_id).exists()


class TestMyHackathonsAndApplicationsExport:
    def test_my_hackathons_endpoint(
        self, api_client, member, active_membership, community, open_hackathon
    ):
        # Member applies
        api_client.force_authenticate(user=member)
        app_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/apply/",
            {"participation_mode": "individual", "accept_terms": True},
            format="json",
        )
        assert app_res.status_code == status.HTTP_201_CREATED

        # GET /api/v1/hackathons/my/
        my_res = api_client.get("/api/v1/hackathons/my/")
        assert my_res.status_code == status.HTTP_200_OK
        assert len(my_res.data["data"]) >= 1
        found = any(
            item["hackathon"]["slug"] == open_hackathon.slug
            for item in my_res.data["data"]
        )
        assert found is True

    def test_applications_export_csv(
        self,
        api_client,
        owner,
        member,
        active_membership,
        stranger,
        community,
        open_hackathon,
    ):
        # Member applies
        api_client.force_authenticate(user=member)
        app_res = api_client.post(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/apply/",
            {"participation_mode": "individual", "accept_terms": True},
            format="json",
        )
        assert app_res.status_code == status.HTTP_201_CREATED

        # Stranger cannot export CSV
        api_client.force_authenticate(user=stranger)
        denied = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/applications/export/"
        )
        assert denied.status_code == status.HTTP_403_FORBIDDEN

        # Owner can export CSV
        api_client.force_authenticate(user=owner)
        res = api_client.get(
            f"/api/v1/communities/{community.slug}/hackathons/{open_hackathon.slug}/applications/export/"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res["Content-Type"].startswith("text/csv")
        content = res.content.decode("utf-8")
        assert "Username" in content
        assert member.username in content
