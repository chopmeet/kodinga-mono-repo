import { ChevronDown, CreditCard, FileText, Flag, LogIn, UserPlus, UsersRound } from 'lucide-react';
import { useState } from 'react';

import { type ActivityType, type DashboardActivity, recentActivities } from '@/data/admin-dashboard.data';
import { nameInitials } from '@/utils/Utils';

const ACTION_CONFIG: Record<ActivityType, { icon: typeof UserPlus; color: string; bg: string }> = {
  community: { icon: UsersRound, color: 'text-blue-700', bg: 'bg-blue-50' },
  member: { icon: UserPlus, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  post: { icon: FileText, color: 'text-sky-700', bg: 'bg-sky-50' },
  payment: { icon: CreditCard, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  report: { icon: Flag, color: 'text-red-600', bg: 'bg-red-50' },
  login: { icon: LogIn, color: 'text-slate-600', bg: 'bg-slate-100' },
};

function formatRelativeTime(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `il y a ${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  return diffDay === 1 ? 'hier' : `il y a ${diffDay} j`;
}


const PAGE = 5;

export default function RecentActivities({ activities = recentActivities }: { activities?: DashboardActivity[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const visible = activities.slice(0, visibleCount);

  if (activities.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-400">Aucune activité pour le moment.</p>;
  }

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {visible.map((activity) => {
          const config = ACTION_CONFIG[activity.type];
          const Icon = config.icon;
          return (
            <li key={activity.id} className="flex items-start gap-3 px-1 py-3.5">
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                <Icon className={`size-4.5 ${config.color}`} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-slate-700">
                  <span className="font-medium text-slate-900">{activity.actor}</span> {activity.action}
                  {activity.target && <span className="font-medium text-slate-900"> · {activity.target}</span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  <time dateTime={activity.at}>{formatRelativeTime(activity.at)}</time>
                </p>
              </div>
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-white"
                aria-hidden
              >
                {nameInitials(activity.actor)}
              </div>
            </li>
          );
        })}
      </ul>

      {visibleCount < activities.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          Voir plus
          <ChevronDown className="size-4" />
        </button>
      )}
    </div>
  );
}
