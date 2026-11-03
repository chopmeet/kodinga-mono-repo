import logging
from typing import Any, Optional

from django.db import transaction

from apps.accounts.models.user import User
from apps.ai.models.peer_match import (
    MatchStatus,
    MatchType,
    PeerMatchRecommendation,
)
from apps.communities.models.community import Community
from apps.hackathons.models.hackathon import Hackathon
from apps.memberships.models.member import CommunityMember, MembershipStatus

logger = logging.getLogger(__name__)


class PeerMatchService:
    """
    Intelligent pair matching and hackathon teammate recommendation service.
    Analyzes technical skills, progress, and objectives to form synergistic partnerships.
    """

    @classmethod
    def get_or_generate_peer_matches(
        cls,
        user: User,
        community: Community,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Returns top recommended peers in the community for pair programming / mutual learning.
        """
        # Fetch active members of the community
        members = (
            CommunityMember.objects.filter(
                community=community,
                status=MembershipStatus.ACTIVE,
            )
            .exclude(user=user)
            .select_related("user", "user__profile")[:30]
        )

        user_skills = set()
        if hasattr(user, "profile") and user.profile:
            user_skills = set(
                user.profile.skills.values_list("technology__name", flat=True)
                if hasattr(user.profile, "skills")
                else []
            )

        existing_recommendations = PeerMatchRecommendation.objects.filter(
            source_user=user,
            community=community,
        ).select_related("target_user", "target_user__profile")

        existing_map = {rec.target_user_id: rec for rec in existing_recommendations}

        matches = []
        for mem in members:
            target_user = mem.user
            rec = existing_map.get(target_user.id)

            if not rec:
                target_skills = set()
                if hasattr(target_user, "profile") and target_user.profile:
                    target_skills = set(
                        target_user.profile.skills.values_list("technology__name", flat=True)
                        if hasattr(target_user.profile, "skills")
                        else []
                    )

                # Synergistic scoring: complementary skills + shared passion
                shared_skills = list(user_skills.intersection(target_skills))
                complementary_skills = list(target_skills.difference(user_skills))

                reasons = []
                if shared_skills:
                    reasons.append(f"Compétences partagées : {', '.join(shared_skills[:3])}")
                if complementary_skills:
                    reasons.append(f"Compétences complémentaires : {', '.join(complementary_skills[:3])}")
                if not reasons:
                    reasons.append(f"Membre actif et motivé de la communauté {community.name}")

                base_score = 0.75 + (0.05 * min(len(shared_skills), 3)) + (0.05 * min(len(complementary_skills), 2))
                final_score = min(0.98, round(base_score, 2))

                rec = PeerMatchRecommendation.objects.create(
                    source_user=user,
                    target_user=target_user,
                    community=community,
                    match_type=MatchType.PAIR_PROGRAMMING,
                    compatibility_score=final_score,
                    match_reasons=reasons,
                    status=MatchStatus.SUGGESTED,
                )

            avatar_url = None
            if hasattr(target_user, "profile") and target_user.profile and hasattr(target_user.profile, "avatar"):
                avatar_url = getattr(target_user.profile.avatar, "url", None)

            matches.append({
                "id": str(rec.id),
                "user_id": str(target_user.id),
                "username": target_user.username,
                "first_name": target_user.first_name,
                "last_name": target_user.last_name,
                "avatar_url": avatar_url,
                "match_type": rec.match_type,
                "compatibility_score": rec.compatibility_score,
                "match_reasons": rec.match_reasons,
                "status": rec.status,
            })

        matches.sort(key=lambda x: x["compatibility_score"], reverse=True)
        return matches[:limit]

    @classmethod
    def suggest_hackathon_teammates(
        cls,
        user: User,
        hackathon: Hackathon,
        desired_skills: Optional[list[str]] = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Finds synergistic teammates for a hackathon participant or team.
        """
        desired = set(s.lower() for s in (desired_skills or []))

        # Participants of this hackathon
        participants = (
            User.objects.filter(
                hackathon_applications__hackathon=hackathon,
                hackathon_applications__status="accepted",
            )
            .exclude(id=user.id)
            .distinct()[:25]
        )

        matches = []
        for candidate in participants:
            candidate_skills = set()
            if hasattr(candidate, "profile") and candidate.profile and hasattr(candidate.profile, "skills"):
                candidate_skills = set(
                    candidate.profile.skills.values_list("technology__name", flat=True)
                )

            matched_skills = [
                s for s in candidate_skills if s.lower() in desired
            ] if desired else list(candidate_skills)

            reasons = []
            if matched_skills:
                reasons.append(f"Maîtrise les compétences recherchées : {', '.join(matched_skills[:3])}")
            else:
                reasons.append(f"Inscrit au hackathon {hackathon.title} avec un profil prêt à collaborer")

            score = 0.80 + (0.05 * min(len(matched_skills), 3))
            final_score = min(0.99, round(score, 2))

            matches.append({
                "id": str(candidate.id),
                "user_id": str(candidate.id),
                "username": candidate.username,
                "first_name": candidate.first_name,
                "last_name": candidate.last_name,
                "avatar_url": getattr(getattr(candidate, "profile", None), "avatar_url", None),
                "match_type": MatchType.HACKATHON_TEAM,
                "compatibility_score": final_score,
                "match_reasons": reasons,
                "status": MatchStatus.SUGGESTED,
            })

        matches.sort(key=lambda x: x["compatibility_score"], reverse=True)
        return matches[:limit]

    @classmethod
    @transaction.atomic
    def respond_to_match(cls, user: User, match_id: str, action: str) -> PeerMatchRecommendation:
        """
        Accepts or declines a peer match proposal.
        """
        rec = PeerMatchRecommendation.objects.select_for_update().get(id=match_id)
        if rec.source_user_id != user.id and rec.target_user_id != user.id:
            raise PermissionError("Vous n'êtes pas autorisé à modifier cette recommandation.")

        if action == "accept":
            rec.status = MatchStatus.ACCEPTED
        elif action == "decline":
            rec.status = MatchStatus.DECLINED
        rec.save(update_fields=["status", "updated_at"])
        return rec

PeerMatchingService = PeerMatchService
