import { ChevronUp, FolderKanban, Images, MessageCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, cn, customToast, Loader } from '@kodinga/ui';
import ProjectFormModal from '@/pages/community-space/projects/modals/project-form-modal';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { useGetCommunityProjectsQuery, useToggleProjectUpvoteMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ProjectListItem, ProjectOrder } from '@/utils/api/project/project.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import { LockedPanel } from './locked-panel';
import { Pill, SectionHeader } from './section-header';
import { getName } from '@/utils/Utils';

/** Vote of a project; visitors are sent to the login page */
export function UpvoteButton({ project, page }: { project: Pick<ProjectListItem, 'slug' | 'title' | 'is_upvoted' | 'upvotes_count'>; page: Pick<CommunityPage, 'membership' | 'loginUrl'> }) {
  const { t } = useTranslation();
  const [toggle, { isLoading }] = useToggleProjectUpvoteMutation();
  const label = t(project.is_upvoted ? 'community.projects.unvote' : 'community.projects.upvote', { title: project.title, count: project.upvotes_count });
  const className = cn(
    'flex w-14 shrink-0 flex-col items-center rounded-lg border py-2 text-sm font-semibold transition-colors',
    project.is_upvoted ? 'border-blue-900 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
  );
  if (page.membership === 'visitor') {
    return (
      <Link to={page.loginUrl} aria-label={label} className={className}>
        <ChevronUp className="size-5" aria-hidden />
        {project.upvotes_count}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={project.is_upvoted}
      disabled={isLoading}
      onClick={() => toggle(project.slug).unwrap().catch((error) => customToast.error({ message: parseApiError(error).message }))}
      className={className}
    >
      <ChevronUp className="size-5" aria-hidden />
      {project.upvotes_count}
    </button>
  );
}

/** Projects built by the members: votes, a page each, sharing one's own */
export function ProjectsTab({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const slug = page.slug;
  const [order, setOrder] = useState<ProjectOrder>('upvotes');
  const [sharing, setSharing] = useState(false);
  const { data = [], isLoading } = useGetCommunityProjectsQuery({ community: slug, order_by: order }, { skip: !page.canSee });
  const projects = data.filter((p) => p.status === 'published');

  const header = (
    <SectionHeader
      eyebrow={t('community.projects.eyebrow')}
      title={t('community.projects.title')}
      aside={
        page.membership === 'member' && page.community ? (
          <Button onClick={() => setSharing(true)}>
            <Plus /> {t('community.projects.share')}
          </Button>
        ) : (
          <FolderKanban className="size-7 text-amber-600" aria-hidden />
        )
      }
    >
      {t('community.projects.intro')}
    </SectionHeader>
  );

  if (!page.canSee) {
    return (
      <section>
        {header}
        <LockedPanel page={page}>{t('community.projects.locked')}</LockedPanel>
      </section>
    );
  }

  return (
    <section>
      {header}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('community.projects.sort')}>
        {(
          [
            ['upvotes', t('community.projects.mostVoted')],
            ['recent', t('community.projects.mostRecent')],
          ] as const
        ).map(([id, label]) => (
          <Pill key={id} active={order === id} onClick={() => setOrder(id)}>
            {label}
          </Pill>
        ))}
      </div>
      {isLoading ? (
        <Loader inline size="sm" message={t('community.projects.loading')} />
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <FolderKanban className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">{t('community.projects.none')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('community.projects.beFirst')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label={t('community.projects.title')}>
          {projects.map((p) => (
            <li key={p.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="relative hidden h-24 w-36 shrink-0 overflow-hidden rounded-lg sm:block">
                {p.cover_image_url ? <img src={p.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
                {(p.demo_images?.length ?? 0) > 0 && (
                  <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    <Images className="size-3" aria-hidden />
                    <span className="sr-only">{t('community.projects.screenshots')}</span>
                    {p.demo_images?.length}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg text-slate-900">
                  <Link to={`/projects/${p.slug}?from=${slug}`} className="hover:text-blue-900 hover:underline">
                    {p.title}
                  </Link>
                </h3>
                {p.tagline && <p className="mt-0.5 text-sm text-slate-600">{p.tagline}</p>}
                <p className="mt-2 text-xs text-slate-500">
                  {t('community.projects.by', { name: getName(p.owner) })}
                  {p.technologies.length > 0 && ` · ${p.technologies.map((t) => t.name).join(' · ')}`}
                </p>
                <Link to={`/projects/${p.slug}?from=${slug}#commentaires`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-900">
                  <MessageCircle className="size-3.5" aria-hidden /> {t('community.projects.reviews')}
                </Link>
              </div>
              <UpvoteButton project={p} page={page} />
            </li>
          ))}
        </ul>
      )}
      {page.community && <ProjectFormModal communityId={page.community.id} open={sharing} project={null} onClose={() => setSharing(false)} />}
    </section>
  );
}
