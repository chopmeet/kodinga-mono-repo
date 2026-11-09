import { BookOpen, CalendarDays, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { CommunityAvatar } from '@/pages/shared/community-avatar';
import type { DiscoveryCommunity, DiscoveryCourse, DiscoveryDeveloper, DiscoveryEvent, DiscoveryPost } from '@/utils/api/discovery/discovery.type';
import { dateFormat } from '@/utils/format';
import i18n from '@/utils/i18n';
import { formatCompact, nameInitials } from '@/utils/Utils';

const when = (iso: string) => dateFormat({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
/** "1,2 k membres": the number in short, the word in the current language */
const plural = (n: number, key: 'members' | 'lessons' | 'replies') => i18n.t(`search.${key}`, { count: n, formatted: formatCompact(n) });

function Row({ to, media, title, meta }: { to: string; media: ReactNode; title: string; meta: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
        {media}
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-900">{title}</span>
          <span className="block truncate text-xs text-slate-500">{meta}</span>
        </span>
      </Link>
    </li>
  );
}

const Icon = ({ children }: { children: ReactNode }) => (
  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-hidden>
    {children}
  </span>
);

const Thumb = ({ src, fallback }: { src: string; fallback: ReactNode }) =>
  src ? <img src={src} alt="" className="size-10 shrink-0 rounded-lg object-cover" /> : <Icon>{fallback}</Icon>;

export const CommunityRow = ({ c }: { c: DiscoveryCommunity }) => (
  <Row
    to={`/communities/${c.slug}`}
    media={<CommunityAvatar community={{ name: c.name, avatar_url: c.avatar_url, brand_color: '' }} className="size-10 rounded-lg text-xs" />}
    title={c.name}
    meta={`${plural(c.members_count, 'members')} · ${c.pricing_type === 'paid' ? i18n.t('search.paid') : i18n.t('search.free')}`}
  />
);

export const CourseRow = ({ c }: { c: DiscoveryCourse }) => (
  <Row
    to={`/communities/${c.community_slug}/courses/${c.slug}`}
    media={<Thumb src={c.thumbnail_url} fallback={<BookOpen className="size-5" />} />}
    title={c.title}
    meta={`${c.community_name} · ${plural(c.lessons_count, 'lessons')}`}
  />
);

export const EventRow = ({ e }: { e: DiscoveryEvent }) => (
  <Row
    to={`/communities/${e.community_slug}?tab=events`}
    media={<Thumb src={e.cover_image_url} fallback={<CalendarDays className="size-5" />} />}
    title={e.title}
    meta={`${e.community_name} · ${e.status === 'live' ? i18n.t('search.live') : when(e.start_time)}`}
  />
);

export const DeveloperRow = ({ d }: { d: DiscoveryDeveloper }) => (
  <Row
    to={`/profiles/${d.username}`}
    media={
      d.avatar_url ? (
        <img src={d.avatar_url} alt="" className="size-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-900" aria-hidden>
          {nameInitials(d.full_name || d.username)}
        </span>
      )
    }
    title={d.full_name || d.username}
    meta={d.headline || `@${d.username}`}
  />
);

// Only the title: the content of a post of a paid community is for its members
export const PostRow = ({ p }: { p: DiscoveryPost }) => (
  <Row
    to={`/communities/${p.community_slug}/posts/${p.id}`}
    media={<Icon>{<MessageSquare className="size-5" />}</Icon>}
    title={p.title || i18n.t('search.discussionBy', { username: p.author_username })}
    meta={`@${p.author_username} · ${plural(p.comments_count, 'replies')}`}
  />
);

