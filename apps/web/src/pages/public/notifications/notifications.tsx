import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, cn } from '@kodinga/ui';
import { useAppSelector } from '@/redux/hook';
import { MyInvitations } from '@/pages/shared/my-invitations';
import { useGetNotificationsQuery } from '@/utils/api/community/community.api';
import { JoinRequestActions, JoinRequestsSection } from './components/join-requests';
import { NotificationContent } from './components/notification-item';
import UseJoinRequests from './form/UseJoinRequests';
import UseNotifications, { notificationHref, useUnreadNotifications } from './form/UseNotifications';

const PAGE_SIZE = 20;

/** /notifications — every notification, unread ones first to filter */
function Notifications() {
  const { t } = useTranslation();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [count, setCount] = useState(PAGE_SIZE);
  const unread = useUnreadNotifications();
  const actions = UseNotifications();
  const joinRequests = UseJoinRequests({ skip: !signedIn });
  const { data, isLoading, isFetching } = useGetNotificationsQuery({ page: 1, page_size: count, unread: unreadOnly || undefined }, { skip: !signedIn });
  const notifications = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  // A join request in the list is answered on its notification, the others above the list
  const notified = new Set(notifications.filter((n) => n.notification_type === 'join_request').map((n) => n.target_id));
  const unnotified = joinRequests.requests.filter((r) => !notified.has(r.member.id));

  if (!signedIn) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <Bell className="size-8 text-faint" />
        <h1 className="text-2xl font-bold text-foreground">{t('inbox.notifications.yours')}</h1>
        <Button asChild>
          <Link to="/auth/login?next=%2Fnotifications">{t('inbox.notifications.login')}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('inbox.notifications.title')}</h1>
          <p className="mt-1 text-muted-foreground">{unread > 0 ? t('inbox.notifications.unread', { count: unread }) : t('inbox.notifications.upToDate')}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={actions.markAll} isLoading={actions.isMarkingAll}>
            <CheckCheck /> {t('inbox.notifications.markAll')}
          </Button>
        )}
      </div>

      <MyInvitations className="mt-6" />

      {!isLoading && <JoinRequestsSection {...joinRequests} requests={unnotified} />}

      <div className="mt-6 flex gap-2" role="group" aria-label={t('inbox.notifications.filter')}>
        {(
          [
            [false, t('inbox.notifications.all')],
            [true, t('inbox.notifications.unreadOnly')],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={unreadOnly === value}
            onClick={() => {
              setUnreadOnly(value);
              setCount(PAGE_SIZE);
            }}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              unreadOnly === value ? 'border-blue-900 bg-blue-900 text-white' : 'border-border bg-card text-soft hover:border-border-strong',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-muted-foreground">{t('inbox.notifications.loading')}</p>
      ) : notifications.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-border bg-card px-6 py-14 text-center">
          <Bell className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-foreground">{unreadOnly ? t('inbox.notifications.noneUnread') : t('inbox.notifications.none')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('inbox.notifications.noneText')}</p>
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border-soft overflow-hidden rounded-xl border border-border bg-card" aria-label={t('inbox.notifications.title')}>
            {notifications.map((n) => {
              const href = notificationHref(n.action_url);
              return (
                <li key={n.id} className={cn('group flex items-start gap-2 px-4 py-4', !n.is_read && 'bg-brand-subtle/40')}>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => actions.open(n)}
                      className={cn('flex min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-900/30', !href && n.is_read && 'cursor-default')}
                    >
                      <NotificationContent notification={n} />
                    </button>
                    {n.notification_type === 'join_request' && (
                      <div className="pl-12">
                        <JoinRequestActions
                          request={joinRequests.requests.find((r) => r.member.id === n.target_id)}
                          decision={joinRequests.decided[n.target_id]}
                          busyId={joinRequests.busyId}
                          accept={(r) => {
                            if (!n.is_read) actions.markRead(n);
                            return joinRequests.accept(r);
                          }}
                          refuse={(r) => {
                            if (!n.is_read) actions.markRead(n);
                            return joinRequests.refuse(r);
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={t('inbox.notifications.delete', { title: n.title })}
                    onClick={() => actions.remove(n)}
                    className="rounded-md p-1.5 text-faint hover:bg-muted hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {notifications.length < total && (
            <Button variant="outline" className="mx-auto mt-6 flex" isLoading={isFetching} onClick={() => setCount((n) => n + PAGE_SIZE)}>
              {t('common.actions.showMore')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

export default Notifications;
