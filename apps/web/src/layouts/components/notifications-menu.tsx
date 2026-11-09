import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@kodinga/ui';
import { NotificationContent } from '@/pages/public/notifications/components/notification-item';
import UseJoinRequests from '@/pages/public/notifications/form/UseJoinRequests';
import UseNotifications, { useUnreadNotifications } from '@/pages/public/notifications/form/UseNotifications';
import { useGetNotificationsQuery } from '@/utils/api/community/community.api';

const LATEST = 8;

/** Bell of the header: unread count, the latest notifications, a link to all of them */
export function NotificationsMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const unread = useUnreadNotifications();
  const actions = UseNotifications();
  // Loaded when the menu opens (the count is enough for the badge)
  const { data, isLoading } = useGetNotificationsQuery({ page: 1, page_size: LATEST }, { skip: !open });
  // Read when the menu opens too (one call per community the user reviews): answered on /notifications.
  // Only the ones not already among the notifications shown here
  const pendingRequests = UseJoinRequests({ skip: !open }).requests.filter(
    (r) => !notifications.some((n) => n.notification_type === 'join_request' && n.target_id === r.member.id),
  ).length;
  const notifications = data?.results ?? [];
  const label = unread > 0 ? t('layout.notifications.unread', { count: unread }) : t('layout.notifications.title');

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className="relative flex size-10 items-center justify-center rounded-lg text-slate-700 transition-colors outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-900/30"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="font-semibold text-slate-900">{t('layout.notifications.title')}</p>
          {unread > 0 && (
            <button type="button" onClick={actions.markAll} disabled={actions.isMarkingAll} className="text-xs font-semibold text-blue-900 hover:underline disabled:opacity-50">
              {t('layout.notifications.markAll')}
            </button>
          )}
        </div>
        {pendingRequests > 0 && (
          <DropdownMenuItem asChild className="rounded-none border-b border-amber-100 bg-amber-50/60 px-4 py-3 text-sm font-semibold text-amber-900">
            <Link to="/notifications">
              {t('layout.notifications.joinRequests', { count: pendingRequests })}
            </Link>
          </DropdownMenuItem>
        )}
        <div className="max-h-[min(28rem,70dvh)] overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">{t('common.actions.loading')}</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">{t('layout.notifications.empty')}</p>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem key={n.id} onSelect={() => actions.open(n)} className={!n.is_read ? 'bg-blue-50/40 rounded-none px-4 py-3' : 'rounded-none px-4 py-3'}>
                <NotificationContent notification={n} compact />
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuItem asChild className="justify-center rounded-none border-t border-slate-100 py-3 text-sm font-semibold text-blue-900">
          <Link to="/notifications">{t('layout.notifications.seeAll')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
