import { useNavigate } from 'react-router-dom';

import { customToast } from '@kodinga/ui';
import { useAppSelector } from '@/redux/hook';
import {
  useDeleteNotificationMutation,
  useGetUnreadNotificationsCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { useRealtime } from '@/utils/realtime/use-realtime';
import type { AppNotification } from '@/utils/api/notification/notification.type';

export const NOTIFICATIONS_POLLING = 30_000;

/**
 * Page of the app for the action_url of a notification, or null. The api names some pages after
 * its own routes: the hackathon ones go to the tabs of the hackathon page, the jury and the members
 * to the space of the community, the others to the page of their content. Badges have no page yet.
 */
export function notificationHref(actionUrl: string): string | null {
  const url = actionUrl.trim();
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  const hackathon = url.match(/^\/communities\/([^/?#]+)\/hackathons\/([^/?#]+)(?:\/([^/?#]+))?\/?$/);
  if (hackathon) {
    const [, slug, hackathonSlug, section] = hackathon;
    const page = `/communities/${slug}/hackathons/${hackathonSlug}`;
    if (!section) return page;
    if (section === 'teams') return `${page}?tab=space`;
    if (section === 'results') return `${page}?tab=results`;
    if (section === 'judging') return `/c/${slug}/hackathons/${hackathonSlug}?tab=projects`;
    return page;
  }
  const content = url.match(/^\/communities\/([^/?#]+)\/(members|classroom|opportunities|projects|events)(?:\/([^/?#]+))?\/?(\?[^#]*)?$/);
  if (content) {
    const [, slug, section, item, query = ''] = content;
    // Those who get them manage the members: join requests, accepted invitations
    if (section === 'members') return `/c/${slug}/members${query}`;
    if (!item) return `/communities/${slug}?tab=${section}`;
    if (section === 'classroom') return `/communities/${slug}/courses/${item}`;
    if (section === 'opportunities') return `/opportunities/${item}`;
    if (section === 'projects') return `/projects/${item}`;
    // An event has no page of its own: the events of the community
    return `/communities/${slug}?tab=events`;
  }
  // The poster of an offer: its page (the applications are managed in the space of the community)
  const offer = url.match(/^\/opportunities\/([^/?#]+)\/applications\/?$/);
  if (offer) return `/opportunities/${offer[1]}`;
  if (/^\/(communities|messages|profiles|c|invitations|invite|opportunities|projects)(\/|$)/.test(url)) return url;
  return null;
}

/** Unread count of the header bell: live through the WebSocket, every 30 s without it */
export function useUnreadNotifications() {
  const signedIn = !!useAppSelector((s) => s.user.token);
  // Pushed by the realtime api; polled only while the WebSocket is down
  const { connected } = useRealtime();
  const { data = 0 } = useGetUnreadNotificationsCountQuery(undefined, { skip: !signedIn, pollingInterval: connected ? 0 : NOTIFICATIONS_POLLING });
  return data;
}

/** Opening a notification marks it read, then goes to its page (when the app has one) */
function UseNotifications() {
  const navigate = useNavigate();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();
  const [remove] = useDeleteNotificationMutation();

  const fail = (error: unknown) => customToast.error({ message: parseApiError(error).message });

  return {
    isMarkingAll,
    open: (n: AppNotification) => {
      if (!n.is_read) markRead(n.id).unwrap().catch(fail);
      const href = notificationHref(n.action_url);
      if (href) navigate(href);
    },
    markRead: (n: AppNotification) => markRead(n.id).unwrap().catch(fail),
    markAll: () => markAll().unwrap().catch(fail),
    remove: (n: AppNotification) => remove(n.id).unwrap().catch(fail),
  };
}

export default UseNotifications;
