import { Hourglass, Laptop, MapPin, Trophy, Users, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { hackathonFormatLabel as formatLabel } from '@/pages/community-space/hackathons/hackathon-labels';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { HackathonListItem } from '@/utils/api/hackathon/hackathon.type';
import { dateFormat } from '@/utils/format';
import i18n from '@/utils/i18n';

const DAY = 86_400_000;

/** "En ligne", "Dakar, Sénégal" */
const place = (h: HackathonListItem) =>
  h.format === 'online' ? i18n.t('discover.hackathonCard.online') : [h.venue_city, h.venue_country].filter(Boolean).join(', ') || formatLabel[h.format];

/** Days left to apply, while the registrations are open */
function deadline(h: HackathonListItem) {
  if (!h.is_registration_open || !h.registration_end) return null;
  const days = Math.ceil((new Date(h.registration_end).getTime() - Date.now()) / DAY);
  return days > 0 ? i18n.t('discover.hackathonCard.deadlineDays', { count: days }) : i18n.t('discover.hackathonCard.deadlineLastDay');
}

/**
 * One hackathon of a list (tab of a community, page /hackathons). `showCommunity` names the
 * community that runs it, for the lists that mix several; `communitySlug` when the list already knows it.
 */
export function HackathonCard({
  hackathon: h,
  showCommunity = false,
  communitySlug,
}: {
  hackathon: HackathonListItem;
  showCommunity?: boolean;
  communitySlug?: string;
}) {
  const { t } = useTranslation();
  const slug = communitySlug ?? h.community.slug;
  const start = new Date(h.start_time);
  const left = deadline(h);
  const to = `/communities/${slug}/hackathons/${h.slug}`;

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative h-36">
        {h.cover_image_url ? <img src={h.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
      </div>
      <div className="flex gap-5 p-6">
        <div className="flex h-20 w-18 shrink-0 flex-col items-center justify-center self-center rounded-xl bg-blue-900 text-white">
          <span className="text-2xl leading-none font-semibold">{dateFormat({ day: '2-digit' }).format(start)}</span>
          <span className="mt-2 text-xs tracking-wide uppercase">{dateFormat({ month: 'short' }).format(start).replace('.', '')}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-blue-900 uppercase">
            {h.format === 'online' ? <Laptop className="size-3.5" /> : <MapPin className="size-3.5" />}
            {formatLabel[h.format]}
          </p>
          <h3 className="mt-1 text-xl text-slate-900">
            <Link to={to} className="hover:text-blue-900 hover:underline">
              {h.title}
            </Link>
          </h3>
          {h.tagline && <p className="mt-1 text-slate-600">{h.tagline}</p>}
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {showCommunity && (
              <Link to={`/communities/${slug}`} className="flex items-center gap-1.5 hover:text-blue-900 hover:underline">
                <UsersRound className="size-4 text-slate-400" /> {h.community.name}
              </Link>
            )}
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-slate-400" /> {place(h)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4 text-slate-400" /> {t('discover.hackathonCard.registered', { count: h.participants_count })}
            </span>
            {h.prizes_count > 0 && (
              <span className="flex items-center gap-1.5">
                <Trophy className="size-4 text-slate-400" /> {t('discover.hackathonCard.prizes', { count: h.prizes_count })}
              </span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {left && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900">
                <Hourglass className="size-3.5" /> {left}
              </span>
            )}
            <Link to={to} className="text-sm font-semibold text-blue-900 hover:underline">
              {h.is_registration_open ? t('discover.hackathonCard.apply') : t('discover.hackathonCard.see')} →
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
