import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, cn } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import { useGetNotificationsQuery } from '@/utils/api/community/community.api';
import { NotificationContent } from './components/notification-item';
import UseNotifications, { notificationHref, useUnreadNotifications } from './form/UseNotifications';

const PAGE_SIZE = 20;

/** /notifications — every notification, unread ones first to filter */
function Notifications() {
  const signedIn = !!useAppSelector((s) => s.user.token);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [count, setCount] = useState(PAGE_SIZE);
  const unread = useUnreadNotifications();
  const actions = UseNotifications();
  const { data, isLoading, isFetching } = useGetNotificationsQuery({ page: 1, page_size: count, unread: unreadOnly || undefined }, { skip: !signedIn });
  const notifications = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  if (!signedIn) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <Bell className="size-8 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">Vos notifications</h1>
        <Button asChild>
          <Link to="/auth/login?next=%2Fnotifications">Se connecter</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-slate-500">{unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Vous êtes à jour.'}</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={actions.markAll} isLoading={actions.isMarkingAll}>
            <CheckCheck /> Tout marquer comme lu
          </Button>
        )}
      </div>

      <div className="mt-6 flex gap-2" role="group" aria-label="Filtre">
        {(
          [
            [false, 'Toutes'],
            [true, 'Non lues'],
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
              unreadOnly === value ? 'border-blue-900 bg-blue-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-slate-500">Chargement des notifications…</p>
      ) : notifications.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <Bell className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">{unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'}</p>
          <p className="mt-1 text-sm text-slate-500">Candidatures, équipes, messages : tout ce qui vous concerne arrivera ici.</p>
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Notifications">
            {notifications.map((n) => {
              const href = notificationHref(n.action_url);
              return (
                <li key={n.id} className={cn('group flex items-start gap-2 px-4 py-4', !n.is_read && 'bg-blue-50/40')}>
                  <button
                    type="button"
                    onClick={() => actions.open(n)}
                    className={cn('flex min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-900/30', !href && n.is_read && 'cursor-default')}
                  >
                    <NotificationContent notification={n} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer la notification : ${n.title}`}
                    onClick={() => actions.remove(n)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {notifications.length < total && (
            <Button variant="outline" className="mx-auto mt-6 flex" isLoading={isFetching} onClick={() => setCount((n) => n + PAGE_SIZE)}>
              Afficher plus
            </Button>
          )}
        </>
      )}
    </section>
  );
}

export default Notifications;
