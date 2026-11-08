import { Award, Briefcase, Code2, ExternalLink, FolderKanban, Globe, GraduationCap, Link2, MessageCircle, Star, ThumbsUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { ago, availabilityLabel, employmentLabel, formatCompact, memberRoleLabel, period, plain, skillLevelLabel } from '@/utils/Utils';
import type { AvailabilityStatus, PublicProfile } from '@/utils/api/profile/profile.type';

const safeUrl = (url?: string) => (url && /^https?:\/\/\S+\.\S+/.test(url) ? url : null);
const handle = (value?: string) => value?.trim().replace(/^@/, '') || '';
const byStart = <T extends { start_date: string }>(list: T[] = []) => [...list].sort((a, b) => b.start_date.localeCompare(a.start_date));

const availabilityStyle: Record<AvailabilityStatus, string> = {
  available: 'bg-emerald-50 text-emerald-800',
  open_to_offers: 'bg-blue-50 text-blue-900',
  busy: 'bg-amber-50 text-amber-800',
  unavailable: 'bg-slate-100 text-slate-600',
};

/** Availability, what the developer is open to, years of experience */
export function ProfileAvailability({ profile }: { profile: PublicProfile }) {
  const status = profile.availability_status as AvailabilityStatus;
  const open = [
    profile.open_to_freelance && 'Freelance',
    profile.open_to_remote && 'Télétravail',
    profile.open_to_relocation && 'Mobilité',
    profile.is_mentor && 'Mentorat',
  ].filter(Boolean) as string[];
  if (!availabilityLabel[status] && open.length === 0 && !profile.years_of_experience) return null;
  return (
    <div className="mt-5 flex flex-col gap-3" aria-label="Disponibilité">
      {availabilityLabel[status] && (
        <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', availabilityStyle[status])}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {availabilityLabel[status]}
        </span>
      )}
      {open.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {open.map((label) => (
            <span key={label} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {label}
            </span>
          ))}
        </p>
      )}
      {profile.years_of_experience ? (
        <p className="text-sm text-slate-600">
          {profile.years_of_experience} an{profile.years_of_experience > 1 ? 's' : ''} d’expérience
        </p>
      ) : null}
    </div>
  );
}

/** GitHub, GitLab, LinkedIn, X and the website, when given */
export function ProfileLinks({ profile }: { profile: PublicProfile }) {
  const links = [
    handle(profile.github_username) && { label: 'GitHub', href: `https://github.com/${handle(profile.github_username)}`, text: handle(profile.github_username), icon: Code2 },
    handle(profile.gitlab_username) && { label: 'GitLab', href: `https://gitlab.com/${handle(profile.gitlab_username)}`, text: handle(profile.gitlab_username), icon: Code2 },
    safeUrl(profile.linkedin_url) && { label: 'LinkedIn', href: profile.linkedin_url, text: 'LinkedIn', icon: Link2 },
    handle(profile.twitter_handle) && { label: 'X', href: `https://x.com/${handle(profile.twitter_handle)}`, text: `@${handle(profile.twitter_handle)}`, icon: Link2 },
    safeUrl(profile.website_url) && { label: 'Site web', href: profile.website_url, text: profile.website_url.replace(/^https?:\/\//, '').replace(/\/$/, ''), icon: Globe },
  ].filter(Boolean) as { label: string; href: string; text: string; icon: typeof Globe }[];
  if (links.length === 0) return null;
  return (
    <ul className="mt-5 space-y-2 text-sm" aria-label="Liens">
      {links.map(({ label, href, text, icon: Icon }) => (
        <li key={label}>
          <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-700 hover:text-primary">
            <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
            <span className="sr-only">{label} : </span>
            <span className="truncate">{text}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Globe; text: string }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-primary" aria-hidden>
        <Icon className="size-6" />
      </span>
      <p className="mt-4 text-sm text-slate-500">{text}</p>
    </div>
  );
}

/** Bio and skills (highlighted ones first) */
export function ProfileAbout({ profile, name }: { profile: PublicProfile; name: string }) {
  const skills = [...(profile.skills ?? [])].sort((a, b) => Number(b.is_highlighted) - Number(a.is_highlighted));
  if (!profile.bio && skills.length === 0) return <Empty icon={Star} text={`${name} n’a pas encore rempli sa présentation.`} />;
  return (
    <div className="flex flex-col gap-8 py-8">
      {profile.bio && <p className="whitespace-pre-line text-slate-700">{profile.bio}</p>}
      {skills.length > 0 && (
        <section aria-labelledby="skills-title">
          <h3 id="skills-title" className="font-semibold text-slate-900">
            Compétences
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Compétences">
            {skills.map((s) => (
              <li key={s.id} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', s.is_highlighted ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700')}>
                {s.is_highlighted && <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="Mise en avant" />}
                <span className="font-medium">{s.technology.name}</span>
                {skillLevelLabel[s.level] && <span className="text-xs text-slate-500">· {skillLevelLabel[s.level]}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Experiences and educations, most recent first */
export function ProfileCareer({ profile, name }: { profile: PublicProfile; name: string }) {
  const experiences = byStart(profile.experiences);
  const educations = byStart(profile.educations);
  if (experiences.length === 0 && educations.length === 0) return <Empty icon={Briefcase} text={`${name} n’a pas encore renseigné son parcours.`} />;
  return (
    <div className="flex flex-col gap-10 py-8">
      {experiences.length > 0 && (
        <section aria-labelledby="experiences-title">
          <h3 id="experiences-title" className="flex items-center gap-2 font-semibold text-slate-900">
            <Briefcase className="size-5 text-primary" aria-hidden /> Expériences
          </h3>
          <ol className="mt-4 space-y-6 border-l border-slate-200 pl-6" aria-label="Expériences">
            {experiences.map((x) => (
              <li key={x.id} className="relative">
                <span className="absolute top-1.5 -left-[1.85rem] size-2.5 rounded-full border-2 border-white bg-primary ring-1 ring-primary/30" aria-hidden />
                <p className="font-semibold text-slate-900">{x.title}</p>
                <p className="text-sm text-slate-700">
                  {safeUrl(x.company_url) ? (
                    <a href={x.company_url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                      {x.company_name}
                    </a>
                  ) : (
                    x.company_name
                  )}
                  {employmentLabel[x.employment_type] && ` · ${employmentLabel[x.employment_type]}`}
                </p>
                <p className="text-sm text-slate-500">{[period(x.start_date, x.end_date, x.is_current), x.is_remote ? 'Télétravail' : x.location].filter(Boolean).join(' · ')}</p>
                {x.description && <p className="mt-2 text-sm whitespace-pre-line text-slate-600">{x.description}</p>}
                {x.technologies.length > 0 && <p className="mt-2 text-xs text-slate-500">{x.technologies.map((t) => t.name).join(' · ')}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {educations.length > 0 && (
        <section aria-labelledby="educations-title">
          <h3 id="educations-title" className="flex items-center gap-2 font-semibold text-slate-900">
            <GraduationCap className="size-5 text-primary" aria-hidden /> Formations
          </h3>
          <ul className="mt-4 space-y-4" aria-label="Formations">
            {educations.map((x) => (
              <li key={x.id}>
                <p className="font-semibold text-slate-900">{x.degree}</p>
                <p className="text-sm text-slate-700">{[x.institution, x.field_of_study].filter(Boolean).join(' · ')}</p>
                <p className="text-sm text-slate-500">{period(x.start_date, x.end_date, x.is_current)}</p>
                {x.description && <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{x.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Portfolio projects, featured ones first */
export function ProfilePortfolio({ profile, name }: { profile: PublicProfile; name: string }) {
  const projects = [...(profile.portfolio_projects ?? [])].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.order - b.order);
  if (projects.length === 0) return <Empty icon={FolderKanban} text={`${name} n’a pas encore ajouté de projet.`} />;
  return (
    <ul className="grid gap-4 py-8 sm:grid-cols-2" aria-label="Portfolio">
      {projects.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="relative h-36">
            {safeUrl(p.thumbnail_url) ? <img src={p.thumbnail_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
            {p.is_featured && (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden /> À la une
              </span>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-slate-900">{p.title}</h3>
            {p.description && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{p.description}</p>}
            {p.technologies.length > 0 && <p className="mt-2 text-xs text-slate-500">{p.technologies.map((t) => t.name).join(' · ')}</p>}
            <p className="mt-3 flex gap-4 text-sm">
              {safeUrl(p.project_url) && (
                <a href={p.project_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  <ExternalLink className="size-3.5" aria-hidden /> Démo
                </a>
              )}
              {safeUrl(p.repo_url) && (
                <a href={p.repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  <Code2 className="size-3.5" aria-hidden /> Code
                </a>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Its public communities (of its profile), with its role in each */
export function ProfileCommunities({ profile, name }: { profile: PublicProfile; name: string }) {
  const communities = profile.communities ?? [];
  if (communities.length === 0) return <Empty icon={Users} text={`${name} ne fait partie d’aucune communauté publique.`} />;
  return (
    <ul className="grid gap-4 py-6 sm:grid-cols-2" aria-label={`Communautés de ${name}`}>
      {communities.map((c) => (
        <li key={c.id}>
          <Link to={`/communities/${c.slug}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary" aria-hidden>
                <Users className="size-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900">{c.name}</span>
              <span className="block text-sm text-slate-500">
                {memberRoleLabel[c.role] ?? c.role} · {formatCompact(c.members_count)} membre{c.members_count > 1 ? 's' : ''}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** What it published: its figures, its latest posts (in public communities) and projects */
export function ProfileContributions({ profile, name }: { profile: PublicProfile; name: string }) {
  const c = profile.contributions;
  if (!c || (c.posts_count === 0 && c.projects_count === 0 && c.badges_count === 0)) return <Empty icon={MessageCircle} text={`${name} n’a pas encore de contribution.`} />;
  return (
    <div className="flex flex-col gap-8 py-6">
      {c.badges_count > 0 && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Award className="size-4 text-amber-600" aria-hidden />
          {c.badges_count} badge{c.badges_count > 1 ? 's' : ''} obtenu{c.badges_count > 1 ? 's' : ''}
        </p>
      )}
      {c.recent_posts.length > 0 && (
        <section aria-label="Dernières publications">
          <h3 className="font-semibold text-slate-900">Dernières publications</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {c.recent_posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  {p.community_slug ? (
                    <Link to={`/communities/${p.community_slug}/posts/${p.id}`} className="block truncate font-medium text-slate-900 hover:text-primary">
                      {plain(p.title) || 'Publication sans titre'}
                    </Link>
                  ) : (
                    <span className="block truncate font-medium text-slate-900">{plain(p.title) || 'Publication sans titre'}</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {p.community_name ? `${p.community_name} · ` : ''}
                    {ago(p.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1" aria-label={`${p.reactions_count} réactions`}>
                    <ThumbsUp className="size-3.5" aria-hidden /> {p.reactions_count}
                  </span>
                  <span className="flex items-center gap-1" aria-label={`${p.comments_count} commentaires`}>
                    <MessageCircle className="size-3.5" aria-hidden /> {p.comments_count}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.recent_projects.length > 0 && (
        <section aria-label="Derniers projets">
          <h3 className="font-semibold text-slate-900">Derniers projets</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {c.recent_projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <Link to={`/projects/${p.slug}`} className="min-w-0 truncate font-medium text-slate-900 hover:text-primary">
                  {p.title}
                </Link>
                <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500" aria-label={`${p.upvotes_count} votes`}>
                  <ThumbsUp className="size-3.5" aria-hidden /> {p.upvotes_count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
