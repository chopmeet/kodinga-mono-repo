from typing import Any, Optional

from rest_framework import status, viewsets
from rest_framework.response import Response

from common.utils.pagination import StandardResultsSetPagination


class BaseCRUDViewSet(viewsets.ModelViewSet):
    """
    Standardized, high-performance ViewSet providing:
    - Dual serializer support (read vs write)
    - Action-specific permission mapping
    - Clean service delegation hooks
    - Default standard pagination
    """
    pagination_class = StandardResultsSetPagination
    write_serializer_class: Optional[type[Any]] = None
    permission_classes_by_action: dict[str, list[Any]] = {}

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update'] and self.write_serializer_class is not None:
            return self.write_serializer_class
        return super().get_serializer_class()

    def get_permissions(self):
        action_permissions = self.permission_classes_by_action.get(self.action)
        if action_permissions is not None:
            return [permission() for permission in action_permissions]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'results': serializer.data
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Format response using read serializer if available
        read_serializer_class = self.serializer_class or self.get_serializer_class()
        response_data = read_serializer_class(serializer.instance, context=self.get_serializer_context()).data
        headers = self.get_success_headers(response_data)
        return Response(
            {
                'success': True,
                'message': 'Resource created successfully.',
                'data': response_data
            },
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        read_serializer_class = self.serializer_class or self.get_serializer_class()
        response_data = read_serializer_class(serializer.instance, context=self.get_serializer_context()).data
        return Response({
            'success': True,
            'message': 'Resource updated successfully.',
            'data': response_data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            'success': True,
            'message': 'Resource deleted successfully.'
        }, status=status.HTTP_204_NO_CONTENT)
