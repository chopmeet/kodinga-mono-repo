import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import { useGetCommunityEventQuery, useJoinLiveEventMutation, useUpdateEventStatusMutation } from '@/utils/api/community/community.api';
import type { LiveJoin } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';
import { liveServerUrl } from '@/utils/http';

/** Until the host starts, the waiting room reads the event again (status: live) */
const WAITING_POLLING = 10_000;

/**
 * /communities/:slug/events/:eventId/live — the LiveKit room of an event. The api gives the token
 * (join-live/): the host publishes camera, microphone and screen; the others watch and chat.
 */
function UseLiveRoom() {
  const { slug = '', eventId = '' } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const [session, setSession] = useState<LiveJoin | null>(null);

  const event = useGetCommunityEventQuery({ slug, eventId }, { skip: !slug || !eventId, pollingInterval: session ? 0 : WAITING_POLLING });
  const [join, { isLoading: isJoining }] = useJoinLiveEventMutation();
  const [updateStatus, { isLoading: isUpdating }] = useUpdateEventStatusMutation();
  const data = event.data;

  const changeStatus = async (status: 'live' | 'completed', message: string) => {
    try {
      await updateStatus({ slug, eventId, status }).unwrap();
      customToast.success({ message });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  return {
    slug,
    event: data,
    isLoading: event.isLoading,
    notFound: [403, 404].includes((event.error as FetchBaseQueryError | undefined)?.status as number),
    signedIn,
    loginUrl: `/auth/login?next=${encodeURIComponent(pathname)}`,
    back: `/communities/${slug}?tab=events`,
    session,
    serverUrl: session ? liveServerUrl(session.server_url) : '',
    isHost: !!session?.is_host,
    isJoining,
    isUpdating,
    join: async () => {
      try {
        setSession(await join({ slug, eventId }).unwrap());
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
      }
    },
    /** The room was left (button, end of the live, connection lost) */
    leave: () => {
      setSession(null);
      event.refetch();
    },
    /** Host: the members waiting are let in */
    start: () => changeStatus('live', 'Vous êtes en direct !'),
    /** Host: ends the live for everyone, back to the events */
    end: async () => {
      if (await changeStatus('completed', 'Le live est terminé. Merci !')) {
        setSession(null);
        navigate(`/communities/${slug}?tab=events`);
      }
    },
  };
}

export type LiveRoom = ReturnType<typeof UseLiveRoom>;

export default UseLiveRoom;
