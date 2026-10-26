from rest_framework.filters import OrderingFilter


class AutoRecentOrderingFilter(OrderingFilter):
    """
    Filtre d'ordonnancement automatique garantissant que les messages
    les plus récents et les ressources nouvellement créées sont toujours
    renvoyés en premier lieu (-created_at / -last_message_at),
    sauf si un tri spécifique explicite est spécifié dans la requête.
    """

    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)

        if ordering:
            return queryset.order_by(*ordering)

        # Si aucun tri explicite n'a été spécifié via query params ou view.ordering
        if hasattr(queryset, "model"):
            model = queryset.model
            fields = {f.name for f in model._meta.get_fields()}
            query_order = getattr(queryset.query, "order_by", None)

            # Si le queryset n'a pas déjà un order_by explicite non vide
            if not query_order:
                if "is_pinned" in fields and "created_at" in fields:
                    return queryset.order_by("-is_pinned", "-created_at")
                elif "last_message_at" in fields and "created_at" in fields:
                    return queryset.order_by("-last_message_at", "-created_at")
                elif "last_message_at" in fields:
                    return queryset.order_by("-last_message_at")
                elif "created_at" in fields:
                    return queryset.order_by("-created_at")
                elif "date_joined" in fields:
                    return queryset.order_by("-date_joined")

        return queryset
