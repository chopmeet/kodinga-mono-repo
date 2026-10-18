from typing import Any, Generic, Optional, TypeVar

from django.db import models, transaction

from common.exceptions.handler import ResourceNotFoundError

ModelType = TypeVar("ModelType", bound=models.Model)


class BaseCRUDService(Generic[ModelType]):
    """
    Generic base service for unified CRUD operations with atomic transactions and validation hooks.
    """
    model: type[ModelType]

    def __init__(self, model: Optional[type[ModelType]] = None):
        if model:
            self.model = model

    def get_by_id(self, pk: Any) -> ModelType:
        try:
            return self.model.objects.get(pk=pk)
        except self.model.DoesNotExist as err:
            raise ResourceNotFoundError(f"{self.model.__name__} with ID {pk} does not exist.") from err

    def list(self, **filters) -> models.QuerySet:
        return self.model.objects.filter(**filters)

    @transaction.atomic
    def create(self, **data) -> ModelType:
        instance = self.model(**data)
        instance.full_clean()
        instance.save()
        return instance

    @transaction.atomic
    def update(self, instance: ModelType, **data) -> ModelType:
        for field, value in data.items():
            setattr(instance, field, value)
        instance.full_clean()
        instance.save()
        return instance

    @transaction.atomic
    def delete(self, instance: ModelType) -> None:
        instance.delete()
