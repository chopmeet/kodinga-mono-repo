import { ArrowLeft, Code2, ExternalLink, Images, MessageCircle, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, Loader } from '@kodinga-mono-repo/ui';
import ProjectFormModal from '@/pages/community-space/projects/modals/project-form-modal';
import { UpvoteButton } from '@/pages/public/community/components/projects-tab';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { ImageGallery } from '@/pages/shared/image-gallery';
import { Markdown } from '@/pages/shared/markdown';
import type { ProjectPerson } from '@/utils/api/project/project.type';
import { ago, nameInitials } from '@/utils/Utils';
import UseProjectPage, { type ProjectPage } from './form/UseProjectPage';

const personName = (p: ProjectPerson) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username;
const safeUrl = (url: string) => (/^https?:\/\/\S+\.\S+/.test(url) ? url : null);

function Person({ person, size = 'size-9' }: { person: ProjectPerson; size?: string }) {
  return person.avatar_url ? (
    <img src={person.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-900 text-xs font-semibold text-white`} aria-hidden>
      {nameInitials(personName(person))}
    </span>
  );
}

function CommentForm({ page, parentId, onDone, placeholder }: { page: ProjectPage; parentId?: string; onDone?: () => void; placeholder: string }) {
  const [text, setText] = useState('');
  if (!page.signedIn) {
    return (
      <Link to={page.loginUrl} className="text-sm font-semibold text-blue-900 hover:underline">
        Connectez-vous pour donner votre avis
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
        {parentId ? 'Répondre' : 'Publier'}
      </Button>
    </form>
  );
}

function Comments({ page }: { page: ProjectPage }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  return (
    <section id="commentaires" aria-labelledby="comments-title" className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 id="comments-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <MessageCircle className="size-5 text-blue-900" /> Avis ({page.comments.length})
      </h2>
      <div className="mt-4">
        <CommentForm page={page} placeholder="Votre avis sur le projet…" />
      </div>
      {page.comments.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Aucun avis pour le moment : soyez le premier.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5" aria-label="Commentaires">
          {page.comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Person person={c.author} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-slate-900">{personName(c.author)}</span> <span className="text-slate-400">· {ago(c.created_at)}</span>
                </p>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{c.content}</p>
                {page.signedIn && (
                  <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="mt-1 text-xs font-semibold text-slate-500 hover:text-blue-900">
                    Répondre
                  </button>
                )}
                {c.replies.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-3 border-l border-slate-200 pl-4" aria-label={`Réponses à ${personName(c.author)}`}>
                    {c.replies.map((r) => (
                      <li key={r.id} className="flex gap-2.5">
                        <Person person={r.author} size="size-7" />
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold text-slate-900">{personName(r.author)}</span> <span className="text-slate-400">· {ago(r.created_at)}</span>
                          </p>
                          <p className="mt-0.5 text-sm whitespace-pre-line text-slate-700">{r.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {replyTo === c.id && (
                  <div className="mt-3">
                    <CommentForm page={page} parentId={c.id} placeholder={`Répondre à ${personName(c.author)}…`} onDone={() => setReplyTo(null)} />
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
  const page = UseProjectPage();
  const p = page.project;
  const [editing, setEditing] = useState(false);

  if (page.isLoading) return <Loader inline className="py-24" message="Chargement du projet…" />;
  if (!p) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{page.notFound ? 'Projet introuvable' : 'Impossible de charger le projet'}</h1>
        <Button asChild variant="outline">
          <Link to={page.back.to}>Retour</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white">
        <div className="relative h-44 sm:h-60">{p.cover_image_url ? <img src={p.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}</div>
        <div className="mx-auto max-w-285 px-4 py-6 sm:px-6 lg:px-8">
          <Link to={page.back.to} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> {page.back.label}
          </Link>
          <div className="mt-4 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{p.title}</h1>
              {p.tagline && <p className="mt-1 text-lg text-slate-600">{p.tagline}</p>}
              <Link to={`/profiles/${p.owner.username}`} className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 hover:text-blue-900">
                <Person person={p.owner} size="size-7" />
                {personName(p.owner)}
              </Link>
            </div>
            <UpvoteButton project={p} page={page.voter} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {safeUrl(p.demo_url) && (
              <Button asChild>
                <a href={p.demo_url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Voir la démo
                </a>
              </Button>
            )}
            {safeUrl(p.repository_url) && (
              <Button asChild variant="outline">
                <a href={p.repository_url} target="_blank" rel="noreferrer">
                  <Code2 /> Code source
                </a>
              </Button>
            )}
            {page.isOwner && p.community_id && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Modifier
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-285 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          {p.description ? <Markdown source={p.description} /> : <p className="text-slate-500">Pas encore de présentation détaillée.</p>}
          {p.technologies.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5" aria-label="Technologies">
              {p.technologies.map((t) => (
                <li key={t.id} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-900">
                  {t.name}
                </li>
              ))}
            </ul>
          )}
        </article>
        {(p.demo_images?.length ?? 0) > 0 && (
          <section aria-labelledby="demo-title" className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 id="demo-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Images className="size-5 text-blue-900" /> Captures ({p.demo_images?.length})
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
