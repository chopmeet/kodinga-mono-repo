from django.contrib import admin

from apps.hackathons.models import (
    Hackathon,
    HackathonApplication,
    HackathonCriterion,
    HackathonEvaluation,
    HackathonJudge,
    HackathonPrize,
    HackathonSubmission,
    HackathonTeam,
)


class PrizeInline(admin.TabularInline):
    model = HackathonPrize
    extra = 1


class CriterionInline(admin.TabularInline):
    model = HackathonCriterion
    extra = 1


class JudgeInline(admin.TabularInline):
    model = HackathonJudge
    extra = 1


@admin.register(Hackathon)
class HackathonAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "community",
        "organizer",
        "format",
        "status",
        "start_time",
        "submission_deadline",
        "results_published",
        "created_at",
    )
    list_filter = ("status", "format", "results_published", "start_time")
    search_fields = ("title", "description", "community__name", "organizer__username")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [PrizeInline, CriterionInline, JudgeInline]


@admin.register(HackathonApplication)
class HackathonApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "applicant",
        "hackathon",
        "participation_mode",
        "status",
        "reviewed_at",
        "created_at",
    )
    list_filter = ("status", "participation_mode")
    search_fields = ("applicant__username", "hackathon__title")


@admin.register(HackathonTeam)
class HackathonTeamAdmin(admin.ModelAdmin):
    list_display = ("name", "hackathon", "leader", "created_at")
    search_fields = ("name", "hackathon__title", "leader__username")


@admin.register(HackathonSubmission)
class HackathonSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "hackathon",
        "applicant",
        "team",
        "status",
        "is_final",
        "total_score",
        "rank",
        "submitted_at",
    )
    list_filter = ("status", "is_final", "rank")
    search_fields = ("title", "hackathon__title", "applicant__username", "team__name")


@admin.register(HackathonEvaluation)
class HackathonEvaluationAdmin(admin.ModelAdmin):
    list_display = (
        "submission",
        "judge",
        "weighted_score",
        "is_submitted",
        "submitted_at",
    )
    list_filter = ("is_submitted",)
    search_fields = ("submission__title", "judge__username")
