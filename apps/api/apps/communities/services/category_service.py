import logging

from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.communities.models.category import CommunityCategory

logger = logging.getLogger(__name__)


class CategoryService:
    @classmethod
    def create_category(cls, data: dict) -> CommunityCategory:
        name = data.get('name')
        slug = data.get('slug') or slugify(name)
        data['slug'] = slug

        if CommunityCategory.objects.filter(name__iexact=name).exists():
            raise ValidationError({'name': "Une catégorie avec ce nom existe déjà."})

        if CommunityCategory.objects.filter(slug__iexact=slug).exists():
            raise ValidationError({'slug': "Une catégorie avec ce slug existe déjà."})

        category = CommunityCategory.objects.create(**data)
        logger.info(f"Category created: {category.name} (id={category.id})")
        return category

    @classmethod
    def update_category(cls, category: CommunityCategory, data: dict) -> CommunityCategory:
        name = data.get('name')
        slug = data.get('slug')

        if name and CommunityCategory.objects.filter(name__iexact=name).exclude(id=category.id).exists():
            raise ValidationError({'name': "Une catégorie avec ce nom existe déjà."})

        if slug and CommunityCategory.objects.filter(slug__iexact=slug).exclude(id=category.id).exists():
            raise ValidationError({'slug': "Une catégorie avec ce slug existe déjà."})

        for attr, value in data.items():
            setattr(category, attr, value)

        category.save()
        logger.info(f"Category updated: {category.name} (id={category.id})")
        return category

    @classmethod
    def delete_category(cls, category: CommunityCategory, hard_delete: bool = False) -> None:
        if hard_delete:
            category.delete()
        else:
            category.is_active = False
            category.save(update_fields=['is_active'])
        logger.info(f"Category deleted/deactivated: {category.name} (id={category.id})")
