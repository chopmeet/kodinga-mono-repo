import { useState } from 'react';

import { customToast } from '@kodinga/ui';
import i18n from '@/utils/i18n';
import { useGetHelpAssistanceQuery, usePingMentorsMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';

/**
 * Help on an unsolved question, for its author and the team (who alone may ask mentors): what the
 * question may lack, and the members whose skills match it. Read only for them: the first reading
 * makes the api write it.
 */
function UseHelpAssistance(postId: string, enabled: boolean) {
  const { data, isLoading, error } = useGetHelpAssistanceQuery(postId, { skip: !enabled });
  const [ping, { isLoading: isSending }] = usePingMentorsMutation();
  /** The mentors left out by the author (all are asked otherwise) */
  const [skipped, setSkipped] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const mentors = data?.suggested_mentors ?? [];
  const chosen = mentors.filter((m) => !skipped.includes(m.user_id)).map((m) => m.user_id);

  return {
    help: data,
    mentors,
    chosen,
    isLoading,
    failed: !!error,
    notified: data?.status === 'notified',
    message,
    setMessage,
    isSending,
    toggle: (userId: string) => setSkipped((all) => (all.includes(userId) ? all.filter((id) => id !== userId) : [...all, userId])),
    send: async () => {
      try {
        const { notified_count } = await ping({ postId, mentor_ids: chosen, custom_message: message.trim() || undefined }).unwrap();
        customToast.success({
          message:
            notified_count > 1
              ? i18n.t('community.toasts.mentorsNotified', { count: notified_count })
              : notified_count === 1
                ? i18n.t('community.toasts.mentorNotified')
                : i18n.t('community.toasts.nobodyNotified'),
        });
      } catch (err) {
        customToast.error({ message: parseApiError(err).message });
      }
    },
  };
}

export default UseHelpAssistance;
