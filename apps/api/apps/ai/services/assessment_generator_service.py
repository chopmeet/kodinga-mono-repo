import json
import logging
from typing import Any

from django.db import transaction

from apps.ai.router import ai_router
from apps.classroom.models.lesson import Lesson, LessonType

logger = logging.getLogger(__name__)


class AssessmentGeneratorService:
    """
    Automates the generation of educational assessments (Quizzes & Code Exercises)
    directly from lesson content, video transcripts, and course objectives.
    """

    @classmethod
    def generate_quiz(
        cls,
        lesson: Lesson,
        num_questions: int = 3,
        difficulty: str = "intermediate",
        language: str = "fr",
    ) -> list[dict[str, Any]]:
        """
        Generates structured QCM quiz questions based on lesson content.
        """
        lesson_content = lesson.content or ""
        video_transcript = ""
        if lesson.video_asset and isinstance(lesson.video_asset.metadata, dict):
            video_transcript = lesson.video_asset.metadata.get("transcription", "")

        context_text = f"Titre: {lesson.title}\nCours: {lesson.module.course.title}\n\nContenu:\n{lesson_content[:4000]}"
        if video_transcript:
            context_text += f"\n\nTranscription vidéo:\n{video_transcript[:3000]}"

        prompt = (
            f"Tu es un expert pédagogique et concepteur de formations en développement informatique.\n"
            f"À partir du contenu de cours ci-dessous, génère exactement {num_questions} questions à choix multiples (QCM).\n"
            f"Niveau de difficulté : {difficulty}.\n"
            f"Langue : {language}.\n\n"
            f"Contenu pédagogique :\n{context_text}\n\n"
            f"Exigences strictes :\n"
            f"1. Chaque question doit comporter exactement 4 options.\n"
            f"2. Une seule option doit être correcte (indiquée par son index 0, 1, 2 ou 3).\n"
            f"3. Fournis une explication pédagogique claire justifiant la bonne réponse.\n\n"
            f"Réponds STRICTEMENT sous forme de JSON valide avec le schéma suivant :\n"
            f'{{\n'
            f'  "questions": [\n'
            f'    {{\n'
            f'      "question": "Texte clair et précis de la question",\n'
            f'      "options": ["Option 0", "Option 1", "Option 2", "Option 3"],\n'
            f'      "correct_index": 1,\n'
            f'      "explanation": "Explication pédagogique détaillée"\n'
            f'    }}\n'
            f'  ]\n'
            f'}}'
        )

        try:
            res = ai_router.assistant_chat(
                message=prompt,
                history=[],
                context={"module": "quiz_generator", "lesson_id": str(lesson.id)},
                language=language,
            )
            raw_reply = res.reply
            clean = raw_reply.strip()
            if "```json" in clean:
                clean = clean.split("```json")[1].split("```")[0].strip()
            elif "```" in clean:
                clean = clean.split("```")[1].split("```")[0].strip()
            data = json.loads(clean)
            questions = data.get("questions", [])
            if questions:
                return questions, True
        except Exception as err:
            logger.warning(f"[generate_quiz] AI generation or parsing failed: {err}. Returning structured fallback.")

        return [
            {
                "question": f"Quel est le concept clé abordé dans '{lesson.title}' ?",
                "options": [
                    lesson.title,
                    "Une notion non abordée",
                    "Un détail secondaire",
                    "Une syntaxe obsolète",
                ],
                "correct_index": 0,
                "explanation": f"La leçon '{lesson.title}' introduit les fondamentaux de ce concept.",
            }
        ], False

    @classmethod
    def generate_code_exercise(
        cls,
        lesson: Lesson,
        language_code: str = "python",
        difficulty: str = "intermediate",
        instructions: str = "",
        language: str = "fr",
    ) -> dict[str, Any]:
        """
        Generates practical code exercise with instructions, starter code,
        solution code, and automated test cases.
        """
        context_text = f"Titre: {lesson.title}\nCours: {lesson.module.course.title}\n\nContenu:\n{(lesson.content or '')[:3000]}"

        prompt = (
            f"Tu es un formateur senior en ingénierie logicielle.\n"
            f"Génère un exercice pratique de code en {language_code} adapté à cette leçon.\n"
            f"Niveau : {difficulty}.\n"
            f"Focus supplémentaire : {instructions or 'Mettre en pratique les concepts clés de la leçon'}.\n\n"
            f"Leçon :\n{context_text}\n\n"
            f"Réponds STRICTEMENT en JSON valide avec la structure suivante :\n"
            f'{{\n'
            f'  "title": "Titre percutant de l\'exercice",\n'
            f'  "instructions_markdown": "Consignes détaillées au format Markdown avec exemples",\n'
            f'  "starter_code": "# Signature de fonction avec docstring et pass ou TODO",\n'
            f'  "solution_code": "# Solution de référence fonctionnelle",\n'
            f'  "test_cases": [\n'
            f'    {{"input": "param", "expected_output": "valeur"}}\n'
            f'  ],\n'
            f'  "language": "{language_code}"\n'
            f'}}'
        )

        try:
            res = ai_router.assistant_chat(
                message=prompt,
                history=[],
                context={"module": "exercise_generator", "lesson_id": str(lesson.id)},
                language=language,
            )
            raw_reply = res.reply
            clean = raw_reply.strip()
            if "```json" in clean:
                clean = clean.split("```json")[1].split("```")[0].strip()
            elif "```" in clean:
                clean = clean.split("```")[1].split("```")[0].strip()
            data = json.loads(clean)
            return {
                "title": data.get("title", f"Exercice pratique : {lesson.title}"),
                "instructions_markdown": data.get("instructions_markdown", "Implémentez la fonction demandée."),
                "starter_code": data.get("starter_code", "def solution():\n    # Votre code ici\n    pass\n"),
                "solution_code": data.get("solution_code", "def solution():\n    return True\n"),
                "test_cases": data.get("test_cases", [{"input": "test", "expected_output": "True"}]),
                "language": data.get("language", language_code),
            }, True
        except Exception as err:
            logger.warning(f"[generate_code_exercise] AI generation or parsing failed: {err}. Returning fallback.")
            return {
                "title": f"Exercice pratique : {lesson.title}",
                "instructions_markdown": f"Mettez en application les notions découvertes dans **{lesson.title}**.",
                "starter_code": f"# Exercice : {lesson.title}\ndef solve():\n    # TODO: Écrivez votre code ici\n    pass\n",
                "solution_code": f"# Solution : {lesson.title}\ndef solve():\n    return True\n",
                "test_cases": [{"input": "example", "expected_output": "True"}],
                "language": language_code,
            }, False

    @classmethod
    @transaction.atomic
    def apply_code_exercise_to_lesson(
        cls,
        lesson: Lesson,
        exercise_data: dict[str, Any],
    ) -> Lesson:
        """
        Persists generated code exercise into the lesson model.
        """
        lesson.lesson_type = LessonType.CODE_EXERCISE
        if "instructions_markdown" in exercise_data:
            lesson.content = exercise_data["instructions_markdown"]
        if "language" in exercise_data:
            lesson.code_language = exercise_data["language"]
        if "starter_code" in exercise_data:
            lesson.code_snippet = exercise_data["starter_code"]

        lesson.code_blocks = [
            {
                "id": "starter",
                "title": "Code de départ",
                "language": exercise_data.get("language", lesson.code_language),
                "code": exercise_data.get("starter_code", ""),
            },
            {
                "id": "solution",
                "title": "Solution de référence",
                "language": exercise_data.get("language", lesson.code_language),
                "code": exercise_data.get("solution_code", ""),
            },
            {
                "id": "test_cases",
                "title": "Cas de test",
                "language": "json",
                "code": json.dumps(exercise_data.get("test_cases", []), indent=2),
            },
        ]
        lesson.save()
        return lesson

    @classmethod
    @transaction.atomic
    def apply_quiz_to_lesson(
        cls,
        lesson: Lesson,
        quiz_data: dict[str, Any],
    ) -> Lesson:
        """
        Persists generated quiz into the lesson model.
        """
        lesson.lesson_type = LessonType.QUIZ
        lesson.quiz_data = quiz_data
        lesson.save(update_fields=["lesson_type", "quiz_data", "updated_at"])
        return lesson
