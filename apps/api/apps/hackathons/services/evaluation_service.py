from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Avg
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.hackathons.models.criterion import HackathonCriterion
from apps.hackathons.models.evaluation import (
    HackathonEvaluation,
    HackathonEvaluationScore,
)
from apps.hackathons.models.hackathon import Hackathon
from apps.hackathons.models.submission import HackathonSubmission
from apps.hackathons.selectors.hackathon_selector import HackathonSelector


class HackathonEvaluationService:
    """
    Handles judge evaluations, weighted score computation,
    and consolidated leaderboard rankings.
    """

    @classmethod
    @transaction.atomic
    def evaluate_project(
        cls,
        judge: User,
        submission: HackathonSubmission,
        scores_data: list[dict[str, Any]],
        general_feedback: str = "",
        private_notes: str = "",
        is_submitted: bool = True,
    ) -> HackathonEvaluation:
        hackathon = submission.hackathon
        if not HackathonSelector.is_hackathon_judge(judge, hackathon):
            raise PermissionDenied("Vous n'êtes pas autorisé à évaluer les projets de ce hackathon.")

        # Ensure project is officially submitted
        if not submission.is_final:
            raise ValidationError("Ce projet est encore à l'état de brouillon et ne peut pas être évalué.")

        evaluation, _ = HackathonEvaluation.objects.get_or_create(
            submission=submission,
            judge=judge,
        )

        total_weighted_points = Decimal("0.0")
        total_weights = Decimal("0.0")

        for item in scores_data:
            criterion_id = item.get("criterion_id")
            score_val = Decimal(str(item.get("score", 0)))
            comment = item.get("comment", "")

            criterion = HackathonCriterion.objects.filter(
                id=criterion_id, hackathon=hackathon
            ).first()

            if not criterion:
                raise ValidationError({"criterion": f"Critère introuvable avec l'identifiant {criterion_id}."})

            if score_val < criterion.min_score or score_val > criterion.max_score:
                raise ValidationError(
                    {"score": f"La note pour '{criterion.name}' doit être comprise entre {criterion.min_score} et {criterion.max_score}."}
                )

            HackathonEvaluationScore.objects.update_or_create(
                evaluation=evaluation,
                criterion=criterion,
                defaults={"score": score_val, "comment": comment},
            )

            total_weighted_points += score_val * criterion.weight
            total_weights += criterion.weight

        if total_weights > 0:
            final_weighted_score = round(total_weighted_points / total_weights, 2)
        else:
            final_weighted_score = Decimal("0.0")

        evaluation.weighted_score = final_weighted_score
        evaluation.general_feedback = general_feedback
        evaluation.private_notes = private_notes
        evaluation.is_submitted = is_submitted
        evaluation.submitted_at = timezone.now() if is_submitted else None
        evaluation.save()

        # Recalculate submission consolidated total score
        cls.recalculate_submission_score(submission)
        cls.recalculate_hackathon_rankings(hackathon)

        return evaluation

    @classmethod
    def recalculate_submission_score(cls, submission: HackathonSubmission):
        completed_evals = HackathonEvaluation.objects.filter(
            submission=submission, is_submitted=True
        )
        count = completed_evals.count()
        if count > 0:
            avg_score = completed_evals.aggregate(Avg("weighted_score"))["weighted_score__avg"] or Decimal("0.0")
            submission.total_score = round(Decimal(str(avg_score)), 2)
            submission.evaluations_count = count
        else:
            submission.total_score = Decimal("0.0")
            submission.evaluations_count = 0

        submission.save(update_fields=["total_score", "evaluations_count", "updated_at"])

    @classmethod
    def recalculate_hackathon_rankings(cls, hackathon: Hackathon):
        submissions = (
            HackathonSubmission.objects.filter(hackathon=hackathon, is_final=True)
            .order_by("-total_score", "submitted_at")
        )
        for rank_idx, sub in enumerate(submissions, start=1):
            if sub.rank != rank_idx:
                sub.rank = rank_idx
                sub.save(update_fields=["rank", "updated_at"])
