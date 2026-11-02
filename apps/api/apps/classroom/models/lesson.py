import re
from urllib.parse import parse_qs, urlparse

from common.models.base import BaseModel
from django.db import models

from apps.classroom.models.module import CourseModule
from apps.media.models.video_asset import VideoAsset


class LessonType(models.TextChoices):
    TEXT = 'text', 'Texte & Images / Tutoriel'
    VIDEO = 'video', 'Vidéo'
    HYBRID = 'hybrid', 'Mixte (Vidéo, Texte & Schémas)'
    ARTICLE = 'article', 'Article / Guide'
    CODE_EXERCISE = 'code', 'Exercice de code'
    QUIZ = 'quiz', 'Quiz / QCM'


class ContentFormat(models.TextChoices):
    MARKDOWN = 'markdown', 'Markdown'
    HTML = 'html', 'HTML Enrichi'
    JSON = 'json', 'Rich Text JSON (TipTap/ProseMirror)'


class VideoProvider(models.TextChoices):
    MUX = 'mux', 'Mux HLS'
    UPLOADTHING = 'uploadthing', 'UploadThing CDN'
    YOUTUBE = 'youtube', 'YouTube'
    VIMEO = 'vimeo', 'Vimeo'
    DAILYMOTION = 'dailymotion', 'Dailymotion'
    DIRECT = 'direct', 'Fichier vidéo direct'


def parse_and_normalize_video_url(raw_url: str) -> tuple[str, str, str]:
    """
    Validates and normalizes external or direct video URLs (BE-09).
    Returns (normalized_url, provider, embed_url).
    Raises ValueError if the URL is invalid or from an unsupported platform.
    """
    url = (raw_url or '').strip()
    if not url:
        return '', '', ''

    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        raise ValueError(
            "Lien vidéo non valide. L'URL doit commencer par http:// ou https://."
        )

    host = parsed.netloc.lower()
    if host.startswith('www.'):
        host = host[4:]

    # 1. YouTube (youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/)
    if host in ('youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'):
        video_id = ''
        if host == 'youtu.be':
            video_id = parsed.path.lstrip('/').split('/')[0]
        elif parsed.path.startswith('/watch'):
            qs = parse_qs(parsed.query)
            video_id = (qs.get('v') or [''])[0]
        elif parsed.path.startswith(('/embed/', '/shorts/', '/v/', '/live/')):
            parts = [p for p in parsed.path.split('/') if p]
            if len(parts) >= 2:
                video_id = parts[1]

        video_id = re.sub(r'[^A-Za-z0-9_-]', '', video_id)
        if not video_id or len(video_id) < 6:
            raise ValueError("Identifiant de vidéo YouTube invalide ou manquant dans l'URL.")
        canonical = f"https://www.youtube.com/watch?v={video_id}"
        embed = f"https://www.youtube.com/embed/{video_id}"
        return canonical, VideoProvider.YOUTUBE, embed

    # 2. Vimeo (vimeo.com/<id>, player.vimeo.com/video/<id>)
    if host in ('vimeo.com', 'player.vimeo.com'):
        match = re.search(r'/(?:video/|channels/[^/]+/)?(\d+)', parsed.path)
        if not match:
            raise ValueError("Identifiant de vidéo Vimeo invalide ou manquant dans l'URL.")
        video_id = match.group(1)
        canonical = f"https://vimeo.com/{video_id}"
        embed = f"https://player.vimeo.com/video/{video_id}"
        return canonical, VideoProvider.VIMEO, embed

    # 3. Dailymotion (dailymotion.com/video/<id>, dai.ly/<id>, dailymotion.com/embed/video/<id>)
    if host in ('dailymotion.com', 'dai.ly'):
        video_id = ''
        if host == 'dai.ly':
            video_id = parsed.path.lstrip('/').split('/')[0]
        else:
            match = re.search(r'/(?:embed/)?video/([A-Za-z0-9]+)', parsed.path)
            if match:
                video_id = match.group(1)
        video_id = video_id.split('_')[0]
        if not video_id:
            raise ValueError("Identifiant de vidéo Dailymotion invalide ou manquant dans l'URL.")
        canonical = f"https://www.dailymotion.com/video/{video_id}"
        embed = f"https://www.dailymotion.com/embed/video/{video_id}"
        return canonical, VideoProvider.DAILYMOTION, embed

    # 4. Direct video file or CDN stream (.mp4, .webm, .ogg, .mov, .m3u8, UploadThing, Mux, local /media/)
    path_lower = parsed.path.lower()
    direct_extensions = ('.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv', '.m3u8')
    trusted_video_hosts = ('stream.mux.com', 'utfs.io', 'ufs.sh')
    if (
        path_lower.endswith(direct_extensions)
        or any(host == th or host.endswith(f'.{th}') for th in trusted_video_hosts)
        or '/media/' in path_lower
    ):
        provider = VideoProvider.MUX if 'mux.com' in host else VideoProvider.DIRECT
        return url, provider, url

    raise ValueError(
        "Plateforme ou format vidéo non supporté. "
        "Veuillez fournir un lien YouTube, Vimeo, Dailymotion ou une URL directe vers un fichier vidéo (.mp4, .webm, .m3u8)."
    )


class Lesson(BaseModel):
    """
    Individual lesson unit inside a CourseModule.
    Supports rich text (Markdown / HTML / JSON), images & diagrams, video streams
    (Mux, UploadThing, YouTube, Vimeo, Dailymotion, direct video), code blocks,
    interactive quizzes, and downloadable attachments.
    """
    module = models.ForeignKey(
        CourseModule,
        on_delete=models.CASCADE,
        related_name='lessons',
        db_index=True
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    content = models.TextField(
        blank=True,
        help_text="Contenu texte riche formaté (Markdown, HTML ou JSON structuré)"
    )
    content_format = models.CharField(
        max_length=20,
        choices=ContentFormat.choices,
        default=ContentFormat.MARKDOWN,
        db_index=True
    )
    cover_image_url = models.URLField(
        max_length=1000,
        blank=True,
        help_text="Image d'en-tête ou bannière illustrative de la leçon"
    )
    images = models.JSONField(
        default=list,
        blank=True,
        help_text="Images et schémas rattachés à la leçon [ {url, caption, alt, media_asset_id} ]"
    )
    lesson_type = models.CharField(
        max_length=30,
        choices=LessonType.choices,
        default=LessonType.TEXT,
        db_index=True
    )
    video_asset = models.ForeignKey(
        VideoAsset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='classroom_lessons',
        db_index=True
    )
    video_url = models.URLField(
        max_length=1000,
        blank=True,
        default='',
        help_text="URL vidéo externe (YouTube, Vimeo, Dailymotion) ou lien direct (.mp4, .webm)"
    )
    video_provider = models.CharField(
        max_length=30,
        blank=True,
        default='',
        help_text="Plateforme vidéo : youtube, vimeo, dailymotion, direct, mux, uploadthing"
    )
    code_language = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Langage de programmation principal (ex: python, javascript, typescript, sql)"
    )
    code_snippet = models.TextField(
        blank=True,
        default='',
        help_text="Extrait de code principal de la leçon (indentation et caractères spéciaux préservés)"
    )
    code_blocks = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste structurée de blocs de code [ {id, language, title, code} ]"
    )
    quiz_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configuration et questions du quiz {passing_score, questions: [...]}"
    )
    duration_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Durée de la vidéo ou temps de lecture estimé en secondes"
    )
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_free_preview = models.BooleanField(
        default=False,
        help_text="Accessible librement en avant-première sans restriction séquentielle"
    )
    attachments = models.JSONField(
        default=list,
        blank=True,
        help_text="Fichiers téléchargeables, PDF, code source zippé"
    )

    class Meta:
        db_table = 'classroom_lessons'
        verbose_name = 'Lesson'
        verbose_name_plural = 'Lessons'
        unique_together = ('module', 'slug')
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.module.title} - {self.title} ({self.get_lesson_type_display()})"

    @property
    def video_embed_url(self) -> str:
        if self.video_url:
            try:
                _, _, embed = parse_and_normalize_video_url(self.video_url)
                return embed
            except ValueError:
                return self.video_url
        if self.video_asset:
            return self.video_asset.hls_url
        return ""

    @property
    def video_hls_url(self) -> str:
        if self.video_asset:
            return self.video_asset.hls_url
        if self.video_url and self.video_provider in (VideoProvider.DIRECT, VideoProvider.MUX, VideoProvider.UPLOADTHING, ''):
            return self.video_url
        return ""

    @property
    def video_thumbnail_url(self) -> str:
        if self.video_asset and self.video_asset.thumbnail_url:
            return self.video_asset.thumbnail_url
        if self.video_url and self.video_provider == VideoProvider.YOUTUBE:
            try:
                canonical, _, _ = parse_and_normalize_video_url(self.video_url)
                vid = parse_qs(urlparse(canonical).query).get('v', [''])[0]
                if vid:
                    return f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"
            except Exception:
                pass
        return self.cover_image_url or ""

    @property
    def video_playback_id(self) -> str:
        return self.video_asset.playback_id if self.video_asset and self.video_asset.playback_id else ""

    @property
    def video_status(self) -> str:
        if self.video_asset:
            return self.video_asset.status
        if self.video_url:
            return "ready"
        return ""

    @property
    def video_source_url(self) -> str:
        """
        Original raw video file URL hosted on UploadThing CDN or external video link.
        """
        if self.video_asset and isinstance(self.video_asset.metadata, dict):
            src = self.video_asset.metadata.get('source_url') or self.video_asset.metadata.get('file_url')
            if src:
                return src
        return self.video_url or ""

    @property
    def reading_time_minutes(self) -> int:
        """
        Estimated reading time based on 200 words per minute average reading speed.
        """
        if not self.content:
            return 1
        word_count = len(self.content.split())
        return max(1, round(word_count / 200))

    @property
    def estimated_duration_display(self) -> str:
        """
        Human-readable duration display (e.g., '14:20' for videos or '6 min de lecture' for articles).
        """
        if (self.video_asset or self.video_url) and self.duration_seconds:
            mins = self.duration_seconds // 60
            secs = self.duration_seconds % 60
            return f"{mins}:{secs:02d}"
        if self.content:
            return f"{self.reading_time_minutes} min de lecture"
        return "1 min"

    def save(self, *args, **kwargs):
        if self.video_url and not self.video_provider:
            canonical, provider, _ = parse_and_normalize_video_url(self.video_url)
            self.video_url = canonical
            self.video_provider = provider
        super().save(*args, **kwargs)

    @property
    def has_video(self) -> bool:
        return bool(self.video_asset_id or self.video_url)

    @property
    def has_images(self) -> bool:
        return bool(self.cover_image_url or self.images)
