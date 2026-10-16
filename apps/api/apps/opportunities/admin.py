from django.contrib import admin

from apps.opportunities.models.application import OpportunityApplication
from apps.opportunities.models.opportunity import Opportunity


@admin.register(Opportunity)
class OpportunityAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "title",
        "company_name",
        "opportunity_type",
        "workplace_type",
        "experience_level",
        "status",
        "views_count",
        "applications_count",
        "created_at",
    ]
    list_filter = ["opportunity_type", "workplace_type", "experience_level", "status"]
    search_fields = ["title", "company_name", "poster__username"]
    prepopulated_fields = {"slug": ("company_name", "title")}


@admin.register(OpportunityApplication)
class OpportunityApplicationAdmin(admin.ModelAdmin):
    list_display = ["id", "opportunity", "applicant", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["opportunity__title", "applicant__username", "applicant__email"]
