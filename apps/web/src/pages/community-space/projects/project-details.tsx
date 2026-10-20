import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowBigUp, ArrowLeft, CalendarClock, ExternalLink, Eye, GitBranch, Pencil, Star, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { Button, ColgateWrapper, customToast, DetailsPageSkeleton, EmptyAlert } from '@kodinga-mono-repo/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { personName } from '@/pages/shared/person';
import { dateFormat, RowActions } from '@/pages/shared/row-actions';
import { useGetProjectQuery, useToggleProjectUpvoteMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { useCommunitySpace } from '../community-space-context';
import { ProjectComments } from './components/project-comments';
import UseProjectActions from './form/UseProjectActions';
import ProjectFormModal from './modals/project-form-modal';

/** /c/:slug/projects/:projectSlug — one project, its votes and its comments */
function ProjectDetails() {
  const { community } = useCommunitySpace();
  const { projectSlug = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back = `/c/${community.slug}/projects`;
  const { data: p, isLoading, error } = useGetProjectQuery(projectSlug, { skip: !projectSlug });
  const [toggleUpvote, { isLoading: isVoting }] = useToggleProjectUpvoteMutation();
  const [editing, setEditing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { canHandle, actionsFor, confirmDialog } = UseProjectActions({ onEdit: () => setEditing(true), afterDelete: () => navigate(back) });

  // "Modifier" from the list lands here with { edit: true }
  const openEdit = (location.state as { edit?: boolean } | null)?.edit === true && !!p && canHandle(p);
  useEffect(() => {
    if (!openEdit) return;
    setEditing(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [openEdit, navigate, location.pathname]);

  if (isLoading) return <DetailsPageSkeleton />;
  // A project of another community is not shown here
  if (!p || p.community_id !== community.id) {
    const notFound = !!p || (error as FetchBaseQueryError | undefined)?.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyAlert text={notFound ? 'Ce projet est introuvable dans la communauté.' : 'Impossible de charger le projet.'} />
        <Button asChild variant="outline" size="sm">
          <Link to={back}>Retour aux projets</Link>
        </Button>
      </div>
    );
  }

  const vote = async () => {
    try {
      await toggleUpvote(p.slug).unwrap();
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  const facts = [
    { icon: UserRound, label: 'Par', value: `${personName(p.owner)}${p.owner.headline ? ` · ${p.owner.headline}` : ''}` },
    { icon: ArrowBigUp, label: 'Votes', value: String(p.upvotes_count) },
    { icon: Eye, label: 'Vues', value: String(p.views_count) },
    { icon: CalendarClock, label: 'Partagé le', value: dateFormat.format(new Date(p.created_at)) },
  ];

  return (
    <div className="community__project">
      <Link to={back} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" />
        Projets
      </Link>

      <ColgateWrapper className="overflow-hidden border border-neutral-200 p-0">
        <div className="relative h-44">
          {p.cover_image_url ? <img src={p.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            {p.is_featured && (
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                <Star className="size-3" aria-hidden />
                Mis en avant
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{p.title}</h1>
            {p.tagline && <p className="mt-1 text-slate-600">{p.tagline}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={p.is_upvoted ? 'default' : 'outline'} size="sm" onClick={vote} isLoading={isVoting} aria-pressed={p.is_upvoted}>
              <ArrowBigUp />
              {p.is_upvoted ? 'Voté' : 'Voter'} · {p.upvotes_count}
            </Button>
            {canHandle(p) && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Modifier
              </Button>
            )}
            <RowActions label={`Actions pour ${p.title}`} actions={actionsFor(p, { withEdit: false })} />
          </div>
        </div>
      </ColgateWrapper>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ColgateWrapper className="border border-neutral-200 p-5">
            <h2 className="font-semibold text-slate-900">Présentation</h2>
            <p className="mt-3 whitespace-pre-line text-slate-700">{p.description || 'Pas encore de description.'}</p>
            {(p.repository_url || p.demo_url) && (
              <div className="mt-5 flex flex-wrap gap-4 text-sm">
                {p.repository_url && (
                  <a href={p.repository_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                    <GitBranch className="size-4" />
                    Code source
                  </a>
                )}
                {p.demo_url && (
                  <a href={p.demo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                    <ExternalLink className="size-4" />
                    Démo
                  </a>
                )}
              </div>
            )}
          </ColgateWrapper>

          {/* Galerie des captures d'écran de démo */}
          {p.demo_images && p.demo_images.length > 0 && (
            <ColgateWrapper className="border border-neutral-200 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">
                  Captures d'écran & Démo ({p.demo_images.length})
                </h2>
                <span className="text-xs text-slate-500">Cliquer pour agrandir</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {p.demo_images.map((imgUrl, i) => (
                  <button
                    key={`${imgUrl}-${i}`}
                    type="button"
                    onClick={() => setSelectedImage(imgUrl)}
                    className="group relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-blue-400 hover:shadow-md"
                  >
                    <img
                      src={imgUrl}
                      alt={`Capture démo ${i + 1}`}
                      className="size-full object-cover transition duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                      <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white shadow-xs">
                        Agrandir
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ColgateWrapper>
          )}

          <ProjectComments projectSlug={p.slug} />
        </div>

        <ColgateWrapper className="h-fit border border-neutral-200 p-5">
          <dl className="space-y-4">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm font-medium text-slate-900">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
          {p.technologies.length > 0 && (
            <>
              <h2 className="mt-5 text-xs text-slate-500">Technologies</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Technologies">
                {p.technologies.map((t) => (
                  <li key={t.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {t.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ColgateWrapper>
      </div>

      <ProjectFormModal communityId={community.id} open={editing} project={p} onClose={() => setEditing(false)} />
      {confirmDialog}

      {/* Lightbox plein écran pour les captures démo */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Capture d'écran plein écran" className="max-h-[85vh] w-auto rounded-xl object-contain shadow-2xl" />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 flex size-8 items-center justify-center rounded-full bg-white font-bold text-slate-800 shadow-lg transition hover:bg-slate-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetails;
