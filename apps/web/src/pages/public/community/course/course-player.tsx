import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, Clock, Download, LoaderCircle, Lock, PartyPopper, PlayCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, cn, Loader } from '@kodinga/ui';
import { courseLevelLabel, formatDuration, lessonTypeLabel } from '@/pages/community-space/courses/course-labels';
import { htmlToText, Markdown } from '@/pages/shared/markdown';
import type { CourseLesson } from '@/utils/api/course/course.type';
import { exerciseOfLesson } from '@/pages/shared/code-exercise';
import { CodeExerciseView } from './code-exercise-view';
import { CourseCompletedDialog } from './course-completed-dialog';
import { QuizView } from './quiz-view';
import UseCoursePlayer, { type CoursePlayer } from './form/UseCoursePlayer';

function Centered({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">{children}</section>;
}

/** Modules and lessons: done, open, locked */
function Outline({ player }: { player: CoursePlayer }) {
  const { t } = useTranslation();
  const modules = [...(player.course?.modules ?? [])].sort((a, b) => a.order - b.order);
  return (
    <nav aria-label={t('course.outline')} className="space-y-5">
      {modules.map((m, mi) => (
        <section key={m.id}>
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t('course.module', { n: mi + 1, title: m.title })}
          </h2>
          <ol className="mt-2 space-y-1">
            {[...m.lessons]
              .sort((a, b) => a.order - b.order)
              .map((l) => {
                const current = l.id === player.outline?.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => player.open(l.id)}
                      disabled={l.is_locked}
                      aria-current={current ? 'step' : undefined}
                      title={l.is_locked ? t('course.lockedHint') : undefined}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed',
                        current ? 'bg-blue-50 font-semibold text-blue-950' : 'text-slate-700 hover:bg-slate-50',
                        l.is_locked && 'text-slate-400',
                      )}
                    >
                      {l.is_completed ? (
                        <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-label={t('course.done')} />
                      ) : l.is_locked ? (
                        <Lock className="size-4 shrink-0" aria-label={t('course.locked')} />
                      ) : (
                        <PlayCircle className={cn('size-4 shrink-0', current ? 'text-blue-900' : 'text-slate-400')} aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      {l.duration_seconds > 0 && <span className="shrink-0 text-xs text-slate-400">{formatDuration(l.duration_seconds)}</span>}
                    </button>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </nav>
  );
}

/**
 * Video of a lesson: the original file (stored on UploadThing) plays everywhere; the Mux stream
 * alone needs the HLS player of the browser (Safari)
 */
function LessonVideo({ lesson }: { lesson: CourseLesson }) {
  const { t } = useTranslation();
  // On a platform: its own player
  if (lesson.video_embed_url && ['youtube', 'vimeo', 'dailymotion'].includes(lesson.video_provider ?? '')) {
    return (
      <iframe
        src={lesson.video_embed_url}
        title={t('course.videoOf', { title: lesson.title })}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="aspect-video w-full rounded-xl bg-slate-900"
      />
    );
  }
  const src = lesson.video_source_url || lesson.video_hls_url;
  if (!src) {
    return (
      <p role="status" className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 px-6 text-center text-sm text-slate-500">
        {lesson.video_status === 'errored' ? (
          t('course.videoErrored')
        ) : (
          <>
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
            {t('course.videoPreparing')}
          </>
        )}
      </p>
    );
  }
  return (
    <video controls preload="metadata" poster={lesson.video_thumbnail_url || undefined} className="aspect-video w-full rounded-xl bg-slate-900" src={src}>
      <track kind="captions" />
    </video>
  );
}

function LessonContent({ player }: { player: CoursePlayer }) {
  const { t } = useTranslation();
  const { outline, lesson, nextToDo, next } = player;
  if (!outline) return null;
  if (outline.is_locked) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <Lock className="size-8 text-slate-400" />
        <p className="mt-3 font-semibold text-slate-900">{t('course.lockedTitle')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('course.lockedText')}</p>
        {nextToDo && (
          <Button className="mt-5" onClick={() => player.open(nextToDo.id)}>
            {t('course.resume')} <ArrowRight />
          </Button>
        )}
      </div>
    );
  }
  if (player.isLessonLoading || !lesson) {
    return (
      <Loader inline size="sm" className="py-24" message={t('course.loadingLesson')} />
    );
  }

  const content = lesson.content ?? '';
  // A code exercise with its parts (statement, starting code, solution); else plain Markdown
  const exercise = lesson.lesson_type === 'code' ? exerciseOfLesson(lesson) : null;
  const hasQuiz = (lesson.quiz_data?.questions?.length ?? 0) > 0;
  const images = ((lesson as CourseLesson & { images?: { url: string; caption?: string; alt?: string }[] }).images ?? []).filter((i) => i.url);
  const attachments = (lesson.attachments ?? []).map((a) => ({ name: a.name || a.file_name || t('course.file'), url: a.url || a.file_url })).filter((a) => a.url);

  return (
    <article aria-labelledby="lesson-title" className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-wide text-blue-900 uppercase">
        {t('course.lessonOf', { position: player.position, total: player.lessons.length, type: lessonTypeLabel[lesson.lesson_type] })}
      </p>
      <h1 id="lesson-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {lesson.title}
      </h1>
      {lesson.estimated_duration_display && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          <Clock className="size-4" /> {lesson.estimated_duration_display}
        </p>
      )}

      {lesson.cover_image_url && !lesson.has_video && <img src={lesson.cover_image_url} alt="" className="mt-6 w-full rounded-xl object-cover" />}
      {lesson.has_video && (
        <div className="mt-6">
          <LessonVideo lesson={lesson} />
        </div>
      )}

      <div className="mt-6">
        {!content && !exercise ? (
          <p className="text-slate-500">{lesson.has_video || hasQuiz ? '' : t('course.noContent')}</p>
        ) : lesson.content_format === 'html' ? (
          <Markdown source={htmlToText(content)} />
        ) : lesson.content_format === 'json' ? (
          <p className="text-slate-500">{t('course.notReadable')}</p>
        ) : exercise ? (
          <CodeExerciseView exercise={exercise} />
        ) : (
          <Markdown source={content} />
        )}
      </div>

      {hasQuiz && (
        <div className="mt-6">
          <QuizView key={lesson.id} slug={player.slug} courseSlug={player.courseSlug} lesson={lesson} onGraded={player.quizGraded} />
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-6 space-y-4">
          {images.map((img) => (
            <figure key={img.url}>
              <img src={img.url} alt={img.alt ?? ''} className="w-full rounded-xl border border-slate-200" />
              {img.caption && <figcaption className="mt-1.5 text-center text-xs text-slate-500">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <section aria-label={t('course.resources')} className="mt-8 rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('course.resources')}</h2>
          <ul className="mt-2 space-y-1.5">
            {attachments.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-900 hover:underline">
                  <Download className="size-4" /> {a.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <Button variant="outline" onClick={() => player.previous && player.open(player.previous.id)} disabled={!player.previous}>
          <ArrowLeft /> {t('course.previous')}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {/* A quiz is done by passing it, not by hand */}
          {hasQuiz ? (
            outline.is_completed ? (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <Check className="size-4" aria-hidden /> {t('course.done')}
              </span>
            ) : (
              <span className="text-sm text-slate-500">{t('course.passQuiz')}</span>
            )
          ) : (
            <Button
              variant={outline.is_completed ? 'outline' : 'default'}
              onClick={player.toggleDone}
              isLoading={player.isSaving}
              aria-pressed={!!outline.is_completed}
            >
              {outline.is_completed ? (
                <>
                  <Check /> {t('course.done')}
                </>
              ) : next ? (
                <>
                  {t('course.finishContinue')} <ArrowRight />
                </>
              ) : (
                <>
                  <CircleCheck /> {t('course.markDone')}
                </>
              )}
            </Button>
          )}
          {outline.is_completed && next && !next.is_locked && (
            <Button onClick={() => player.open(next.id)}>
              {t('course.nextLesson')} <ArrowRight />
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}

/** /communities/:slug/courses/:courseSlug — a member follows a course, lesson by lesson */
function CoursePlayerPage() {
  const { t } = useTranslation();
  const player = UseCoursePlayer();
  const { community, course } = player;
  const back = `/communities/${player.slug}?tab=classroom`;

  if (player.isLoading) {
    return (
      <Loader inline className="py-24" message={t('course.loading')} />
    );
  }
  if (player.membership !== 'member') {
    return (
      <Centered>
        <Lock className="size-8 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">{t('course.membersOnly')}</h1>
        <p className="text-slate-500">{t('course.joinToFollow', { name: community?.name ?? t('course.theCommunity') })}</p>
        <Button asChild>
          {player.membership === 'visitor' ? (
            <Link to={player.loginUrl}>{t('course.login')}</Link>
          ) : (
            <Link to={`/communities/${player.slug}`}>{t('course.discoverCommunity')}</Link>
          )}
        </Button>
      </Centered>
    );
  }
  if (!course) {
    return (
      <Centered>
        <h1 className="text-2xl font-bold text-slate-900">{player.notFound ? t('course.notFound') : t('course.loadFailed')}</h1>
        <Button asChild variant="outline">
          <Link to={back}>{t('course.back')}</Link>
        </Button>
      </Centered>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-285 px-4 py-6 sm:px-6 lg:px-8">
          <Link to={back} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> {community?.name} · {t('course.courses')}
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">{courseLevelLabel[course.level]}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{course.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="size-4" /> {t('course.lessons', { count: course.lessons_count })}
                </span>
                {course.duration_seconds > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" /> {formatDuration(course.duration_seconds)}
                  </span>
                )}
              </p>
            </div>
            {!player.isEnrolled && player.progress === 0 && (
              <Button size="lg" onClick={player.start} isLoading={player.isEnrolling}>
                {t('course.start')} <ArrowRight />
              </Button>
            )}
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{t('course.progress')}</span>
              <span className="font-semibold text-blue-900 tabular-nums">{player.progress} %</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-blue-50" role="progressbar" aria-label={t('course.progressLabel')} aria-valuenow={player.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-blue-900 transition-[width]" style={{ width: `${player.progress}%` }} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-285 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[300px_1fr] lg:px-8">
        {/* Phones: the lesson first, the plan after it (no scrolling through the plan at each lesson) */}
        <aside className="order-last rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24 lg:order-0">
          <Outline player={player} />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {player.isFinished && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900" role="status">
              <PartyPopper className="size-6 shrink-0" />
              <p>
                <strong>{t('course.finished')}</strong> {t('course.finishedText', { title: course.title })}
              </p>
            </div>
          )}
          {player.lessons.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">{t('course.preparing')}</p>
          ) : (
            <LessonContent player={player} />
          )}
        </div>
      </div>
      <CourseCompletedDialog player={player} />
    </div>
  );
}

export default CoursePlayerPage;
