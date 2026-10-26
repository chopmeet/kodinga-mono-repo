from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        if hasattr(queryset, "model"):
            query_order = getattr(queryset.query, "order_by", None)
            if not query_order:
                fields = {f.name for f in queryset.model._meta.get_fields()}
                if "is_pinned" in fields and "created_at" in fields:
                    queryset = queryset.order_by("-is_pinned", "-created_at")
                elif "last_message_at" in fields and "created_at" in fields:
                    queryset = queryset.order_by("-last_message_at", "-created_at")
                elif "last_message_at" in fields:
                    queryset = queryset.order_by("-last_message_at")
                elif "created_at" in fields:
                    queryset = queryset.order_by("-created_at")
                elif "date_joined" in fields:
                    queryset = queryset.order_by("-date_joined")
        return super().paginate_queryset(queryset, request, view)

    def get_paginated_response(self, data):
        return Response({
            'success': True,
            'pagination': {
                'count': self.page.paginator.count,
                'total_pages': self.page.paginator.num_pages,
                'current_page': self.page.number,
                'has_next': self.page.has_next(),
                'has_previous': self.page.has_previous(),
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'page_size': self.get_page_size(self.request),
            },
            'results': data
        })


class CommunityGridPagination(StandardResultsSetPagination):
    """
    Default pagination tailored for 3-column grid layouts and infinite scroll (9 per page).
    """
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 50

