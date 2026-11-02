from typing import Any

from apps.accounts.models.user import User
from apps.profiles.models.education import DeveloperEducation
from apps.profiles.models.experience import DeveloperExperience
from apps.profiles.models.portfolio import DeveloperPortfolioProject
from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.models.skill import DeveloperSkill
from apps.profiles.models.technology import Technology
from django.db import transaction
from django.db.models import F
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, ValidationError


class ProfileService:
    """
    Business logic and orchestration for developer profiles and their associated entities.
    """

    @classmethod
    def get_or_create_profile(cls, user: User) -> DeveloperProfile:
        profile, _ = DeveloperProfile.objects.get_or_create(user=user)
        return profile

    @classmethod
    def update_profile(cls, user: User, validated_data: dict[str, Any]) -> DeveloperProfile:
        profile = cls.get_or_create_profile(user)
        for field, value in validated_data.items():
            setattr(profile, field, value)
        profile.save()
        return profile

    @classmethod
    def increment_profile_views(cls, profile: DeveloperProfile) -> None:
        DeveloperProfile.objects.filter(id=profile.id).update(views_count=F('views_count') + 1)

    # --- Technologies & Skills ---

    @classmethod
    def get_or_create_technology(cls, name: str, category: str = 'other') -> Technology:
        slug = slugify(name)
        tech, _ = Technology.objects.get_or_create(
            slug=slug,
            defaults={'name': name.strip(), 'category': category}
        )
        return tech

    @classmethod
    def add_or_update_skill(
        cls,
        user: User,
        level: str,
        years_of_experience: int,
        is_highlighted: bool = False,
        order: int = 0,
        technology_id: str = None,
        technology_name: str = None,
    ) -> DeveloperSkill:
        profile = cls.get_or_create_profile(user)

        if technology_id:
            try:
                tech = Technology.objects.get(id=technology_id)
            except Technology.DoesNotExist as err:
                raise NotFound("Technologie introuvable.") from err
        elif technology_name:
            tech = cls.get_or_create_technology(name=technology_name)
        else:
            raise ValidationError("technology_id ou technology_name est requis.")

        with transaction.atomic():
            skill, created = DeveloperSkill.objects.update_or_create(
                profile=profile,
                technology=tech,
                defaults={
                    'level': level,
                    'years_of_experience': years_of_experience,
                    'is_highlighted': is_highlighted,
                    'order': order,
                }
            )
            if created:
                Technology.objects.filter(id=tech.id).update(usage_count=F('usage_count') + 1)

            return skill

    @classmethod
    def remove_skill(cls, user: User, skill_id: str) -> None:
        profile = cls.get_or_create_profile(user)
        try:
            skill = DeveloperSkill.objects.get(id=skill_id, profile=profile)
            tech_id = skill.technology_id
            skill.delete()
            Technology.objects.filter(id=tech_id, usage_count__gt=0).update(usage_count=F('usage_count') - 1)
        except DeveloperSkill.DoesNotExist as err:
            raise NotFound("Compétence introuvable.") from err

    # --- Experiences ---

    @classmethod
    def add_experience(cls, user: User, data: dict[str, Any], technology_ids: list[str] = None) -> DeveloperExperience:
        profile = cls.get_or_create_profile(user)
        with transaction.atomic():
            exp = DeveloperExperience.objects.create(profile=profile, **data)
            if technology_ids:
                exp.technologies.set(technology_ids)
            return exp

    @classmethod
    def update_experience(cls, user: User, experience_id: str, data: dict[str, Any], technology_ids: list[str] = None) -> DeveloperExperience:
        profile = cls.get_or_create_profile(user)
        try:
            exp = DeveloperExperience.objects.get(id=experience_id, profile=profile)
        except DeveloperExperience.DoesNotExist as err:
            raise NotFound("Expérience professionnelle introuvable.") from err

        with transaction.atomic():
            for key, value in data.items():
                setattr(exp, key, value)
            exp.save()
            if technology_ids is not None:
                exp.technologies.set(technology_ids)
            return exp

    @classmethod
    def delete_experience(cls, user: User, experience_id: str) -> None:
        profile = cls.get_or_create_profile(user)
        try:
            exp = DeveloperExperience.objects.get(id=experience_id, profile=profile)
            exp.delete()
        except DeveloperExperience.DoesNotExist as err:
            raise NotFound("Expérience professionnelle introuvable.") from err

    # --- Educations ---

    @classmethod
    def add_education(cls, user: User, data: dict[str, Any]) -> DeveloperEducation:
        profile = cls.get_or_create_profile(user)
        return DeveloperEducation.objects.create(profile=profile, **data)

    @classmethod
    def update_education(cls, user: User, education_id: str, data: dict[str, Any]) -> DeveloperEducation:
        profile = cls.get_or_create_profile(user)
        try:
            edu = DeveloperEducation.objects.get(id=education_id, profile=profile)
        except DeveloperEducation.DoesNotExist as err:
            raise NotFound("Formation introuvable.") from err

        for key, value in data.items():
            setattr(edu, key, value)
        edu.save()
        return edu

    @classmethod
    def delete_education(cls, user: User, education_id: str) -> None:
        profile = cls.get_or_create_profile(user)
        try:
            edu = DeveloperEducation.objects.get(id=education_id, profile=profile)
            edu.delete()
        except DeveloperEducation.DoesNotExist as err:
            raise NotFound("Formation introuvable.") from err

    # --- Portfolio Projects ---

    @classmethod
    def add_portfolio_project(cls, user: User, data: dict[str, Any], technology_ids: list[str] = None) -> DeveloperPortfolioProject:
        profile = cls.get_or_create_profile(user)
        with transaction.atomic():
            project = DeveloperPortfolioProject.objects.create(profile=profile, **data)
            if technology_ids:
                project.technologies.set(technology_ids)
            return project

    @classmethod
    def update_portfolio_project(cls, user: User, project_id: str, data: dict[str, Any], technology_ids: list[str] = None) -> DeveloperPortfolioProject:
        profile = cls.get_or_create_profile(user)
        try:
            project = DeveloperPortfolioProject.objects.get(id=project_id, profile=profile)
        except DeveloperPortfolioProject.DoesNotExist as err:
            raise NotFound("Projet de portfolio introuvable.") from err

        with transaction.atomic():
            for key, value in data.items():
                setattr(project, key, value)
            project.save()
            if technology_ids is not None:
                project.technologies.set(technology_ids)
            return project

    @classmethod
    def delete_portfolio_project(cls, user: User, project_id: str) -> None:
        profile = cls.get_or_create_profile(user)
        try:
            project = DeveloperPortfolioProject.objects.get(id=project_id, profile=profile)
            project.delete()
        except DeveloperPortfolioProject.DoesNotExist as err:
            raise NotFound("Projet de portfolio introuvable.") from err
