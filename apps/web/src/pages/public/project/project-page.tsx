import { ArrowLeft, Code2, ExternalLink, Images, MessageCircle, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, Loader } from '@kodinga/ui';
import ProjectFormModal from '@/pages/community-space/projects/modals/project-form-modal';
import { UpvoteButton } from '@/pages/public/community/components/projects-tab';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { ImageGallery } from '@/pages/shared/image-gallery';
import { Markdown } from '@/pages/shared/markdown';
import type { ProjectPerson } from '@/utils/api/project/project.type';
import { ago, getName, nameInitials } from '@/utils/Utils';
import UseProjectPage, { type ProjectPage } from './form/UseProjectPage';

const safeUrl = (url: string) => (/^https?:\/\/\S+\.\S+/.test(url) ? url : null);

function Person({ person, size = 'size-9' }: { person: ProjectPerson; size?: string }) {
  return person.avatar_url ? (
    <img src={person.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-900 text-xs font-semibold text-white`} aria-hidden>
      {nameInitials(getName(person))}
    </span>
  );
}

function CommentForm({ page, parentId, onDone, placeholder }: { page: ProjectPage; parentId?: string; onDone?: () => void; placeholder: string }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  if (!page.signedIn) {
    return (
      <Link to={page.loginUrl} className="text-sm font-semibold text-brand-strong hover:underline">
        {t('discover.project.loginToReview')}
      </Link>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (await page.comment(text.trim(), parentId)) {
          setText('');
          onDone?.();
        }
      }}
    >
      <label className="sr-only" htmlFor={`comment-${parentId ?? 'root'}`}>
        {placeholder}
      </label>
      <textarea id={`comment-${parentId ?? 'root'}`} rows={parentId ? 2 : 3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="custom-form-control bg-background px-4 py-2" />
      <Button type="submit" size="sm" className="self-end" disabled={!text.trim()} isLoading={page.isCommenting}>
        {parentId ? t('discover.project.reply') : t('discover.project.publish')}
      </Button>
    </form>
  );
}

function Comments({ page }: { page: ProjectPage }) {
  const { t } = useTranslation();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  return (
    <section id="commentaires" aria-labelledby="comments-title" className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <h2 id="comments-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <MessageCircle className="size-5 text-brand-strong" /> {t('discover.project.reviews', { count: page.comments.length })}
      </h2>
      <div className="mt-4">
        <CommentForm page={page} placeholder={t('discover.project.reviewPlaceholder')} />
      </div>
      {page.comments.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('discover.project.noReview')}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5" aria-label={t('discover.project.comments')}>
          {page.comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Person person={c.author} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-foreground">{getName(c.author)}</span> <span className="text-faint">· {ago(c.created_at)}</span>
                </p>
                <p className="mt-1 text-sm whitespace-pre-line text-body">{c.content}</p>
                {page.signedIn && (
                  <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="mt-1 text-xs font-semibold text-muted-foreground hover:text-brand-strong">
                    {t('discover.project.reply')}
                  </button>
                )}
                {c.replies.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-3 border-l border-border pl-4" aria-label={t('discover.project.repliesTo', { name: getName(c.author) })}>
                    {c.replies.map((r) => (
                      <li key={r.id} className="flex gap-2.5">
                        <Person person={r.author} size="size-7" />
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold text-foreground">{getName(r.author)}</span> <span className="text-faint">· {ago(r.created_at)}</span>
                          </p>
                          <p className="mt-0.5 text-sm whitespace-pre-line text-body">{r.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {replyTo === c.id && (
                  <div className="mt-3">
                    <CommentForm page={page} parentId={c.id} placeholder={t('discover.project.replyTo', { name: getName(c.author) })} onDone={() => setReplyTo(null)} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** /projects/:projectSlug — a project of a member, with votes and feedback */
function ProjectPageView() {
  const { t } = useTranslation();
  const page = UseProjectPage();
  const p = page.project;
  const [editing, setEditing] = useState(false);

  if (page.isLoading) return <Loader inline className="py-24" message={t('discover.project.loading')} />;
  if (!p) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">{page.notFound ? t('discover.project.notFound') : t('discover.project.loadFailed')}</h1>
        <Button asChild variant="outline">
          <Link to={page.back.to}>{t('common.actions.back')}</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="min-h-full bg-subtle/60">
      <header className="border-b border-border bg-card">
        <div className="relative h-44 sm:h-60">{p.cover_image_url ? <img src={p.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}</div>
        <div className="mx-auto max-w-285 px-4 py-6 sm:px-6 lg:px-8">
          <Link to={page.back.to} className="inline-flex items-center gap-2 text-sm text-soft hover:text-foreground">
            <ArrowLeft className="size-4" /> {page.back.label}
          </Link>
          <div className="mt-4 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{p.title}</h1>
              {p.tagline && <p className="mt-1 text-lg text-soft">{p.tagline}</p>}
              <Link to={`/profiles/${p.owner.username}`} className="mt-3 inline-flex items-center gap-2 text-sm text-body hover:text-brand-strong">
                <Person person={p.owner} size="size-7" />
                {getName(p.owner)}
              </Link>
            </div>
            <UpvoteButton project={p} page={page.voter} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {safeUrl(p.demo_url) && (
              <Button asChild>
                <a href={p.demo_url} target="_blank" rel="noreferrer">
                  <ExternalLink /> {t('discover.project.demo')}
                </a>
              </Button>
            )}
            {safeUrl(p.repository_url) && (
              <Button asChild variant="outline">
                <a href={p.repository_url} target="_blank" rel="noreferrer">
                  <Code2 /> {t('discover.project.code')}
                </a>
              </Button>
            )}
            {page.isOwner && p.community_id && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('discover.project.edit')}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-285 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <article className="rounded-xl border border-border bg-card p-6 sm:p-8">
          {p.description ? <Markdown source={p.description} /> : <p className="text-muted-foreground">{t('discover.project.noDescription')}</p>}
          {p.technologies.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2 border-t border-border-soft pt-5" aria-label={t('discover.project.technologies')}>
              {p.technologies.map((tech) => (
                <li key={tech.id} className="rounded-full bg-brand-subtle px-3 py-1 text-sm font-medium text-brand-strong">
                  {tech.name}
                </li>
              ))}
            </ul>
          )}
        </article>
        {(p.demo_images?.length ?? 0) > 0 && (
          <section aria-labelledby="demo-title" className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <h2 id="demo-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Images className="size-5 text-brand-strong" /> {t('discover.project.screenshots', { count: p.demo_images?.length ?? 0 })}
            </h2>
            <ImageGallery images={p.demo_images ?? []} title={p.title} className="mt-4" />
          </section>
        )}
        <Comments page={page} />
      </div>
      {page.isOwner && p.community_id && <ProjectFormModal communityId={p.community_id} open={editing} project={p} onClose={() => setEditing(false)} />}
    </div>
  );
}

export default ProjectPageView;
