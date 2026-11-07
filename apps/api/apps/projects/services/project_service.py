import contextlib

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.gamification.models.reputation import ReputationAction
from apps.gamification.services.gamification_service import GamificationService
from apps.memberships.permissions import check_community_membership
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.projects.models.comment import ProjectComment
from apps.projects.models.project import Project, ProjectStatus
from apps.projects.models.upvote import ProjectUpvote
from common.permissions.base import is_superadmin_user


class ProjectService:
    """
    Business logic for developer project showcase, upvotes, and comments.
    """

    @classmethod
    def _notify_if_published(cls, project: Project, actor) -> None:
        if project.community and project.status == ProjectStatus.PUBLISHED:
            action_url = f"/communities/{project.community.slug}/projects/{project.slug}"
            NotificationService.notify_community_content_published(
                community=project.community,
                actor=actor,
                content_type="project",
                content_id=str(project.id),
                title=project.title,
                action_url=action_url,
            )

    @classmethod
    @transaction.atomic
    def create_project(cls, owner, validated_data, technology_ids=None):
        community = validated_data.get("community")
        if community:
            check_community_membership(owner, community, "publier un projet dans cette communauté")

        project = Project.objects.create(owner=owner, **validated_data)
        if technology_ids:
            project.technologies.set(technology_ids)

        # Gamification reward: publishing a showcase project
        with contextlib.suppress(Exception):
            GamificationService.award_points(
                user=owner,
                action=ReputationAction.POST_CREATED,
                points=25,
                description=f"Publication du projet vitrine: {project.title}",
            )

        cls._notify_if_published(project, owner)
        return project

    @classmethod
    @transaction.atomic
    def update_project(cls, project, user, validated_data, technology_ids=None):
        is_owner = (project.owner_id == user.id)
        is_platform_admin = bool(user.is_staff or is_superadmin_user(user))

        is_community_manager = False
        if project.community:
            from apps.memberships.models.member import (
                CommunityMember,
                CommunityRole,
                MembershipStatus,
            )
            is_community_manager = (
                project.community.owner_id == user.id
                or CommunityMember.objects.filter(
                    community=project.community,
                    user=user,
                    status=MembershipStatus.ACTIVE,
                    role__in=[CommunityRole.OWNER, CommunityRole.ADMIN],
                ).exists()
            )

        # Allow community managers to dissociate a project from their community (community=None)
        is_dissociating_only = (
            is_community_manager
            and "community" in validated_data
            and validated_data.get("community") is None
            and all(k in ["community"] for k in validated_data)
        )

        if not (is_owner or is_platform_admin or is_dissociating_only):
            raise PermissionDenied("Vous n'êtes pas autorisé à modifier ce projet.")

        if is_dissociating_only:
            project.community = None
            project.save(update_fields=["community", "updated_at"])
            return project

        community = validated_data.get("community")
        if community:
            check_community_membership(user, community, "associer ce projet à cette communauté")

        for key, value in validated_data.items():
            setattr(project, key, value)
        project.save()

        if technology_ids is not None:
            project.technologies.set(technology_ids)

        cls._notify_if_published(project, user)
        return project

    @classmethod
    def delete_project(cls, project, user):
        if project.owner_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise PermissionDenied("Vous n'êtes pas autorisé à supprimer ce projet.")
        project.delete()
        return True

    @classmethod
    @transaction.atomic
    def toggle_upvote(cls, project, user):
        if project.community:
            check_community_membership(user, project.community, "voter pour ce projet")

        existing_upvote = ProjectUpvote.objects.filter(project=project, user=user).first()
        if existing_upvote:
            existing_upvote.delete()
            Project.objects.filter(id=project.id).update(upvotes_count=F("upvotes_count") - 1)
            project.refresh_from_db(fields=["upvotes_count"])
            return False, project.upvotes_count

        ProjectUpvote.objects.create(project=project, user=user)
        Project.objects.filter(id=project.id).update(upvotes_count=F("upvotes_count") + 1)
        project.refresh_from_db(fields=["upvotes_count"])

        if project.owner_id != user.id:
            try:
                GamificationService.award_points(
                    user=project.owner,
                    action=ReputationAction.UPVOTE_RECEIVED,
                    points=5,
                    description=f"Vote reçu sur le projet: {project.title}",
                )
                NotificationService.create_notification(
                    recipient=project.owner,
                    title="Nouveau vote reçu",
                    body=f"{user.username} a voté pour votre projet '{project.title}' !",
                    notification_type=NotificationType.POST_INTERACTION,
                    actor=user,
                    action_url=f"/projects/{project.slug}",
                    metadata={"project_id": str(project.id), "slug": project.slug},
                )
            except Exception:
                pass

        return True, project.upvotes_count

    @classmethod
    @transaction.atomic
    def add_comment(cls, project, author, content, parent_id=None):
        if project.community:
            check_community_membership(author, project.community, "commenter ce projet")

        if not content:
            raise ValidationError("Le commentaire ne peut pas être vide.")

        parent = None
        if parent_id:
            parent = ProjectComment.objects.filter(project=project, id=parent_id).first()

        comment = ProjectComment.objects.create(
            project=project,
            author=author,
            content=content,
            parent=parent,
        )

        if project.owner_id != author.id:
            with contextlib.suppress(Exception):
                NotificationService.create_notification(
                    recipient=project.owner,
                    title=f"Commentaire de {author.username}",
                    body=f"{author.username} a commenté votre projet '{project.title}' : {content[:50]}",
                    notification_type=NotificationType.COMMENT_REPLY,
                    actor=author,
                    action_url=f"/projects/{project.slug}",
                    metadata={"project_id": str(project.id), "comment_id": str(comment.id)},
                )

        return comment
